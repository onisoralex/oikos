import apiClient from "./client";
import type {
  PantryItemWithProduct,
  AddItemInput,
  UpdateItemInput,
  Product,
  CreateProductInput,
  UpdateProductInput,
} from "@oikos/shared";

export interface PaginatedItems {
  data: PantryItemWithProduct[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface ListItemsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  category?: string;
  location?: string;
  expiring_within_days?: number;
  sort?: "expiry_asc" | "name_asc" | "added_desc";
  product_id?: number;
}

export interface BarcodeResult {
  found: boolean;
  product?: Product;
  barcode?: string;
}

export interface ExpiringResult {
  expiring_soon: PantryItemWithProduct[];
  expired: PantryItemWithProduct[];
}

export const listPantryItems = async (params?: ListItemsParams): Promise<PaginatedItems> => {
  const res = await apiClient.get("/v1/pantry/items", { params });
  return res.data;
};

export const getPantryItem = async (id: number): Promise<PantryItemWithProduct> => {
  const res = await apiClient.get(`/v1/pantry/items/${id}`);
  return res.data.data; // API wraps single-resource responses in { data: ... }
};

export const createPantryItem = async (data: AddItemInput): Promise<PantryItemWithProduct> => {
  const res = await apiClient.post("/v1/pantry/items", data);
  return res.data.data;
};

export const updatePantryItem = async (
  id: number,
  data: UpdateItemInput,
): Promise<PantryItemWithProduct> => {
  const res = await apiClient.patch(`/v1/pantry/items/${id}`, data);
  return res.data.data;
};

export const deletePantryItem = async (id: number): Promise<void> => {
  await apiClient.delete(`/v1/pantry/items/${id}`);
};

export const lookupBarcode = async (barcode: string): Promise<BarcodeResult> => {
  const res = await apiClient.get(`/v1/pantry/lookup/${barcode}`);
  return res.data.data;
};

export const createProduct = async (data: CreateProductInput): Promise<Product> => {
  const res = await apiClient.post("/v1/pantry/products", data);
  return res.data.data;
};

export const updateProduct = async (id: number, data: UpdateProductInput): Promise<Product> => {
  const res = await apiClient.patch(`/v1/pantry/products/${id}`, data);
  return res.data.data;
};

export const getProduct = async (id: number): Promise<Product> => {
  const res = await apiClient.get(`/v1/pantry/products/${id}`);
  return res.data.data;
};

export const getExpiringItems = async (days?: number): Promise<ExpiringResult> => {
  const res = await apiClient.get("/v1/pantry/expiring", { params: days ? { days } : undefined });
  return res.data.data;
};
