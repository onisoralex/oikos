import { Router, Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { JWT_SECRET } from "../../config.js";
import { AppError } from "../../lib/errors.js";
import { authMiddleware, verifyPassword } from "../../middleware/auth.js";

const router = Router();

const LoginSchema = z.object({
  password: z.string().min(1),
});

router.post("/login", (req: Request, res: Response, next: NextFunction): void => {
  try {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError("Invalid request body", 400, "VALIDATION_ERROR", parsed.error.issues);
    }

    if (!verifyPassword(parsed.data.password)) {
      throw new AppError("Invalid password", 401, "UNAUTHORIZED");
    }

    const token = jwt.sign({ sub: "owner" }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ success: true, data: { token } });
  } catch (err) {
    next(err);
  }
});

router.post("/logout", (_req: Request, res: Response): void => {
  // Server is stateless — no token blacklist needed for single-user. The client discards the token.
  res.json({ success: true });
});

router.get("/me", authMiddleware, (_req: Request, res: Response): void => {
  res.json({ success: true, data: { ok: true } });
});

export default router;
