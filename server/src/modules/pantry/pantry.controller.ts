import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import {
  AddItemSchema,
  UpdateItemSchema,
  CreateProductSchema,
  UpdateProductSchema,
  ListItemsQuerySchema,
} from "@oikos/shared";
import { AppError } from "../../lib/errors.js";
import * as service from "./pantry.service.js";

const ok = (res: Response, data: unknown, status = 200) => {
  res.status(status).json({ success: true, data });
};

const parseBody = <T>(schema: z.ZodType<T>, body: unknown): T => {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new AppError("Validation error", 400, "VALIDATION_ERROR", result.error.issues);
  }
  return result.data;
};

const parseQuery = <T>(schema: z.ZodType<T>, query: unknown): T => {
  const result = schema.safeParse(query);
  if (!result.success) {
    throw new AppError("Invalid query parameters", 400, "VALIDATION_ERROR", result.error.issues);
  }
  return result.data;
};

const parseId = (param: string | undefined): number => {
  const id = parseInt(param ?? "", 10);
  if (isNaN(id)) throw new AppError("Invalid id", 400, "VALIDATION_ERROR");
  return id;
};

export const barcodeLookup = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { barcode } = req.params;
    if (!barcode) throw new AppError("Barcode required", 400, "VALIDATION_ERROR");
    const result = await service.lookupBarcode(barcode);
    ok(res, result);
  } catch (err) {
    next(err);
  }
};

export const listItems = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = parseQuery(ListItemsQuerySchema, req.query);
    const result = await service.listItems(query);
    res.json({
      success: true,
      data: result.items,
      pagination: result.pagination,
    });
  } catch (err) {
    next(err);
  }
};

export const addItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = parseBody(AddItemSchema, req.body);
    const item = await service.addItem(data);
    ok(res, item, 201);
  } catch (err) {
    next(err);
  }
};

export const updateItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseId(req.params["id"]);
    const data = parseBody(UpdateItemSchema, req.body);
    const item = await service.updateItem(id, data);
    ok(res, item);
  } catch (err) {
    next(err);
  }
};

export const deleteItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseId(req.params["id"]);
    await service.deleteItem(id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

export const createProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = parseBody(CreateProductSchema, req.body);
    const product = await service.createProduct(data);
    ok(res, product, 201);
  } catch (err) {
    next(err);
  }
};

export const updateProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseId(req.params["id"]);
    const data = parseBody(UpdateProductSchema, req.body);
    const product = await service.updateProduct(id, data);
    ok(res, product);
  } catch (err) {
    next(err);
  }
};

export const getExpiringItems = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const DaysSchema = z.object({
      days: z.coerce.number().int().positive().max(90).default(7),
    });
    const { days } = parseQuery(DaysSchema, req.query);
    const result = await service.getExpiringItems(days);
    ok(res, {
      expiring_soon: result.expiringSoon,
      expired: result.expired,
    });
  } catch (err) {
    next(err);
  }
};
