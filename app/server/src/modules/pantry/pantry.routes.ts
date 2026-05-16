import { Router } from "express";
import * as controller from "./pantry.controller.js";

const router = Router();

router.get("/lookup/:barcode", controller.barcodeLookup);
router.get("/items", controller.listItems);
router.post("/items", controller.addItem);
router.patch("/items/:id", controller.updateItem);
router.delete("/items/:id", controller.deleteItem);
router.post("/products", controller.createProduct);
router.patch("/products/:id", controller.updateProduct);
router.get("/expiring", controller.getExpiringItems);

export default router;
