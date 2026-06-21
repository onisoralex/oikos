import { z } from "zod";

// ---------------------------------------------------------------------------
// Product
// ---------------------------------------------------------------------------

export const NutritionalInfoSchema = z.object({
  energy_kcal_100g: z.number().nullable().optional(),
  fat_100g: z.number().nullable().optional(),
  saturated_fat_100g: z.number().nullable().optional(),
  carbohydrates_100g: z.number().nullable().optional(),
  sugars_100g: z.number().nullable().optional(),
  fiber_100g: z.number().nullable().optional(),
  proteins_100g: z.number().nullable().optional(),
  salt_100g: z.number().nullable().optional(),
  nutriscore_grade: z.string().nullable().optional(),
  allergens: z.array(z.string()).optional(),
});

export type NutritionalInfo = z.infer<typeof NutritionalInfoSchema>;

export const ProductSchema = z.object({
  id: z.number().int(),
  barcode: z.string().nullable(),
  name: z.string(),
  brand: z.string().nullable(),
  category: z.string().nullable(),
  nutritionalInfo: NutritionalInfoSchema.nullable(),
  imageUrl: z.string().nullable(),
  source: z.enum(["off", "manual"]),
  offId: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type Product = z.infer<typeof ProductSchema>;

export const CreateProductSchema = z.object({
  barcode: z.string().max(30).optional(),
  name: z.string().min(1),
  brand: z.string().optional(),
  category: z.string().optional(),
  nutritionalInfo: NutritionalInfoSchema.optional(),
  imageUrl: z.string().url().optional(),
});

export type CreateProductInput = z.infer<typeof CreateProductSchema>;

export const UpdateProductSchema = CreateProductSchema.partial();

export type UpdateProductInput = z.infer<typeof UpdateProductSchema>;

// ---------------------------------------------------------------------------
// PantryItem
// ---------------------------------------------------------------------------

export const PantryItemSchema = z.object({
  id: z.number().int(),
  productId: z.number().int(),
  quantity: z.number(),
  unit: z.string().nullable(),
  expiryDate: z.coerce.date().nullable(),
  location: z.string().nullable(),
  notes: z.string().nullable(),
  addedAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type PantryItem = z.infer<typeof PantryItemSchema>;

export const PantryItemWithProductSchema = PantryItemSchema.extend({
  productName: z.string(),
  productBrand: z.string().nullable(),
  productCategory: z.string().nullable(),
  productImageUrl: z.string().nullable(),
  daysUntilExpiry: z.number().int().nullable(),
});

export type PantryItemWithProduct = z.infer<typeof PantryItemWithProductSchema>;

export const AddItemSchema = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().positive().default(1),
  unit: z.string().max(20).optional(),
  expiryDate: z.string().optional(), // ISO date string YYYY-MM-DD
  location: z.string().optional(),
  notes: z.string().optional(),
});

export type AddItemInput = z.infer<typeof AddItemSchema>;

export const UpdateItemSchema = z.object({
  quantity: z.number().positive().optional(),
  unit: z.string().max(20).optional(),
  expiryDate: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export type UpdateItemInput = z.infer<typeof UpdateItemSchema>;

// ---------------------------------------------------------------------------
// Query params
// ---------------------------------------------------------------------------

export const ListItemsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(25),
  search: z.string().optional(),
  category: z.string().optional(),
  location: z.string().optional(),
  expiring_within_days: z.coerce.number().int().positive().optional(),
  sort: z.enum(["expiry_asc", "name_asc", "added_desc"]).default("added_desc"),
});

export type ListItemsQuery = z.infer<typeof ListItemsQuerySchema>;
