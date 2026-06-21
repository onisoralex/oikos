import { Prisma } from "@prisma/client";
import { prisma } from "../../db/client.js";
import { lookupBarcode as offLookup } from "../../services/openFoodFacts.js";
import { AppError } from "../../lib/errors.js";
import type {
  AddItemInput,
  UpdateItemInput,
  CreateProductInput,
  UpdateProductInput,
  ListItemsQuery,
} from "@oikos/shared";

// ---------------------------------------------------------------------------
// Barcode lookup
// ---------------------------------------------------------------------------

export const lookupBarcode = async (barcode: string) => {
  // Check DB first — avoids a network round-trip for known products
  const existing = await prisma.product.findUnique({ where: { barcode } });
  if (existing) return { found: true as const, product: existing };

  const offProduct = await offLookup(barcode);
  if (!offProduct) return { found: false as const, barcode };

  try {
    const product = await prisma.product.create({
      data: {
        barcode: offProduct.barcode,
        name: offProduct.name,
        brand: offProduct.brand,
        category: offProduct.category,
        imageUrl: offProduct.imageUrl,
        nutritionalInfo: offProduct.nutritionalInfo as Prisma.InputJsonValue,
        source: "off",
        offId: offProduct.offId,
      },
    });
    return { found: true as const, product };
  } catch (err) {
    // Two rapid scans of the same barcode can race to insert; catch the unique
    // constraint violation (pg error 23505) and return the now-existing row instead.
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      const product = await prisma.product.findUnique({ where: { barcode } });
      if (product) return { found: true as const, product };
    }
    throw err;
  }
};

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export const createProduct = async (data: CreateProductInput) => {
  return prisma.product.create({
    data: {
      barcode: data.barcode ?? null,
      name: data.name,
      brand: data.brand ?? null,
      category: data.category ?? null,
      imageUrl: data.imageUrl ?? null,
      nutritionalInfo: data.nutritionalInfo
        ? (data.nutritionalInfo as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      source: "manual",
    },
  });
};

export const updateProduct = async (id: number, data: UpdateProductInput) => {
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) throw new AppError("Product not found", 404, "PRODUCT_NOT_FOUND");

  return prisma.product.update({
    where: { id },
    data: {
      ...(data.barcode !== undefined && { barcode: data.barcode }),
      ...(data.name !== undefined && { name: data.name }),
      ...(data.brand !== undefined && { brand: data.brand }),
      ...(data.category !== undefined && { category: data.category }),
      ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl }),
      ...(data.nutritionalInfo !== undefined && {
        nutritionalInfo: data.nutritionalInfo as Prisma.InputJsonValue,
      }),
    },
  });
};

// ---------------------------------------------------------------------------
// Pantry items
// ---------------------------------------------------------------------------

// days_until_expiry is computed in SQL so the value is always relative to the
// current DB server date, not the application server date.
const ITEM_SELECT_SQL = `
  SELECT
    pi.id,
    pi.product_id,
    p.name  AS product_name,
    p.brand AS product_brand,
    p.category AS product_category,
    p.image_url AS product_image_url,
    pi.quantity,
    pi.unit,
    pi.expiry_date,
    CAST((pi.expiry_date::date - CURRENT_DATE) AS integer) AS days_until_expiry,
    pi.location,
    pi.notes,
    pi.added_at,
    pi.updated_at
  FROM pantry_items pi
  JOIN products p ON p.id = pi.product_id
`;

// Prisma's $queryRaw returns unknown[] — shape with a lightweight type
interface RawPantryRow {
  id: number;
  product_id: number;
  product_name: string;
  product_brand: string | null;
  product_category: string | null;
  product_image_url: string | null;
  quantity: string; // Prisma returns Decimal as string in raw queries
  unit: string | null;
  expiry_date: Date | null;
  days_until_expiry: number | null;
  location: string | null;
  notes: string | null;
  added_at: Date;
  updated_at: Date;
}

const formatRow = (row: RawPantryRow) => ({
  id: row.id,
  productId: row.product_id,
  productName: row.product_name,
  productBrand: row.product_brand,
  productCategory: row.product_category,
  productImageUrl: row.product_image_url,
  quantity: parseFloat(row.quantity),
  unit: row.unit,
  expiryDate: row.expiry_date,
  daysUntilExpiry: row.days_until_expiry,
  location: row.location,
  notes: row.notes,
  addedAt: row.added_at,
  updatedAt: row.updated_at,
});

export const listItems = async (query: ListItemsQuery) => {
  const { page, pageSize, search, category, location, expiring_within_days, sort } = query;
  const offset = (page - 1) * pageSize;

  const conditions: string[] = [];
  const params: (string | number)[] = [];
  let paramIdx = 1;

  if (search) {
    conditions.push(`p.name ILIKE $${paramIdx}`);
    params.push(`%${search}%`);
    paramIdx++;
  }
  if (category) {
    conditions.push(`p.category = $${paramIdx}`);
    params.push(category);
    paramIdx++;
  }
  if (location) {
    conditions.push(`pi.location = $${paramIdx}`);
    params.push(location);
    paramIdx++;
  }
  if (expiring_within_days !== undefined) {
    conditions.push(`pi.expiry_date <= CURRENT_DATE + ($${paramIdx} || ' days')::interval`);
    params.push(expiring_within_days);
    paramIdx++;
    conditions.push(`pi.expiry_date IS NOT NULL`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const orderMap: Record<string, string> = {
    expiry_asc: "pi.expiry_date ASC NULLS LAST",
    name_asc: "p.name ASC",
    added_desc: "pi.added_at DESC",
  };
  const orderBy = orderMap[sort] ?? "pi.added_at DESC";

  const dataQuery = `
    ${ITEM_SELECT_SQL}
    ${whereClause}
    ORDER BY ${orderBy}
    LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
  `;
  params.push(pageSize, offset);

  const countQuery = `
    SELECT COUNT(*) AS total
    FROM pantry_items pi
    JOIN products p ON p.id = pi.product_id
    ${whereClause}
  `;

  const [rows, countResult] = await Promise.all([
    prisma.$queryRawUnsafe<RawPantryRow[]>(dataQuery, ...params),
    prisma.$queryRawUnsafe<[{ total: string }]>(
      countQuery,
      ...params.slice(0, params.length - 2),
    ),
  ]);

  const total = parseInt(countResult[0]?.total ?? "0", 10);

  return {
    items: rows.map(formatRow),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
};

export const addItem = async (data: AddItemInput) => {
  const product = await prisma.product.findUnique({ where: { id: data.productId } });
  if (!product) throw new AppError("Product not found", 404, "PRODUCT_NOT_FOUND");

  return prisma.pantryItem.create({
    data: {
      productId: data.productId,
      quantity: data.quantity,
      unit: data.unit ?? null,
      expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
      location: data.location ?? null,
      notes: data.notes ?? null,
    },
  });
};

export const updateItem = async (id: number, data: UpdateItemInput) => {
  const item = await prisma.pantryItem.findUnique({ where: { id } });
  if (!item) throw new AppError("Pantry item not found", 404, "ITEM_NOT_FOUND");

  return prisma.pantryItem.update({
    where: { id },
    data: {
      ...(data.quantity !== undefined && { quantity: data.quantity }),
      ...(data.unit !== undefined && { unit: data.unit }),
      ...(data.expiryDate !== undefined && {
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
      }),
      ...(data.location !== undefined && { location: data.location }),
      ...(data.notes !== undefined && { notes: data.notes }),
    },
  });
};

export const deleteItem = async (id: number): Promise<void> => {
  const item = await prisma.pantryItem.findUnique({ where: { id } });
  if (!item) throw new AppError("Pantry item not found", 404, "ITEM_NOT_FOUND");
  await prisma.pantryItem.delete({ where: { id } });
};

// ---------------------------------------------------------------------------
// Expiry warnings
// ---------------------------------------------------------------------------

export const getExpiringItems = async (days: number) => {
  const soonQuery = `
    ${ITEM_SELECT_SQL}
    WHERE pi.expiry_date IS NOT NULL
      AND pi.expiry_date >= CURRENT_DATE
      AND pi.expiry_date <= CURRENT_DATE + ($1 || ' days')::interval
    ORDER BY pi.expiry_date ASC
  `;

  const expiredQuery = `
    ${ITEM_SELECT_SQL}
    WHERE pi.expiry_date IS NOT NULL
      AND pi.expiry_date < CURRENT_DATE
    ORDER BY pi.expiry_date ASC
  `;

  const [soonRows, expiredRows] = await Promise.all([
    prisma.$queryRawUnsafe<RawPantryRow[]>(soonQuery, days),
    prisma.$queryRawUnsafe<RawPantryRow[]>(expiredQuery),
  ]);

  return {
    expiringSoon: soonRows.map(formatRow),
    expired: expiredRows.map(formatRow),
  };
};
