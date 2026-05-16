import axios, { AxiosError } from "axios";
import { AppError } from "../lib/errors.js";
import type { NutritionalInfo } from "@oikos/shared";

export interface OFFProduct {
  offId: string;
  barcode: string;
  name: string;
  brand: string | null;
  category: string | null;
  imageUrl: string | null;
  nutritionalInfo: NutritionalInfo;
}

// OFF terms of service require a User-Agent identifying the application and contact.
// Requests without a proper User-Agent may be rate-limited or blocked.
const USER_AGENT = "Oikos-HomeServer/1.0 (a.j.onisor@gmail.com)";
const TIMEOUT_MS = 8_000;

export const lookupBarcode = async (barcode: string): Promise<OFFProduct | null> => {
  const url = `https://world.openfoodfacts.org/api/v2/product/${barcode}.json`;

  let data: Record<string, unknown>;
  try {
    const response = await axios.get<Record<string, unknown>>(url, {
      headers: { "User-Agent": USER_AGENT },
      timeout: TIMEOUT_MS,
    });
    data = response.data;
  } catch (err) {
    const axiosErr = err as AxiosError;
    if (axiosErr.response?.status === 429) {
      throw new AppError(
        "Product lookup temporarily unavailable. Please try again in a moment or add the product manually.",
        503,
        "OFF_RATE_LIMITED",
      );
    }
    throw err;
  }

  // status === 0 means product not found in OFF
  if (data["status"] === 0 || !data["product"]) {
    return null;
  }

  const p = data["product"] as Record<string, unknown>;
  const nutriments = (p["nutriments"] as Record<string, unknown>) ?? {};

  const nutritionalInfo: NutritionalInfo = {
    energy_kcal_100g: (nutriments["energy-kcal_100g"] as number) ?? null,
    fat_100g: (nutriments["fat_100g"] as number) ?? null,
    saturated_fat_100g: (nutriments["saturated-fat_100g"] as number) ?? null,
    carbohydrates_100g: (nutriments["carbohydrates_100g"] as number) ?? null,
    sugars_100g: (nutriments["sugars_100g"] as number) ?? null,
    fiber_100g: (nutriments["fiber_100g"] as number) ?? null,
    proteins_100g: (nutriments["proteins_100g"] as number) ?? null,
    salt_100g: (nutriments["salt_100g"] as number) ?? null,
    nutriscore_grade: (p["nutriscore_grade"] as string) ?? null,
    allergens:
      ((p["allergens_tags"] as string[]) ?? []).map((t) => t.replace("en:", "")) ?? [],
  };

  // Prefer German product name if available
  const name =
    (p["product_name_de"] as string | undefined) ||
    (p["product_name"] as string | undefined) ||
    "Unknown product";

  // brands may be comma-separated — take first
  const rawBrand = (p["brands"] as string | undefined) ?? null;
  const brand = rawBrand ? (rawBrand.split(",")[0]?.trim() ?? null) : null;

  // categories_tags[0] typically looks like "en:sauces-and-condiments" — strip the prefix
  const categoryTags = (p["categories_tags"] as string[] | undefined) ?? [];
  const rawCategory = categoryTags[0] ?? null;
  const category = rawCategory ? rawCategory.replace(/^[a-z]{2}:/, "") : null;

  return {
    offId: (p["_id"] as string) ?? barcode,
    barcode: (p["code"] as string) ?? barcode,
    name,
    brand,
    category,
    imageUrl: (p["image_front_url"] as string | undefined) ?? null,
    nutritionalInfo,
  };
};
