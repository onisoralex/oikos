import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { JWT_SECRET, APP_PASSWORD } from "../config.js";
import { AppError } from "../lib/errors.js";

export const authMiddleware = (req: Request, _res: Response, next: NextFunction): void => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw new AppError("Not authenticated", 401, "UNAUTHORIZED");
  }
  const token = header.slice(7);
  try {
    jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    throw new AppError("Invalid or expired token", 401, "UNAUTHORIZED");
  }
};

// crypto.timingSafeEqual prevents timing attacks: a naive string comparison
// (===) short-circuits on the first mismatched character, leaking information
// about how many characters of the password were correct. timingSafeEqual
// always takes the same time regardless of where the mismatch occurs.
export const verifyPassword = (candidate: string): boolean => {
  const candidateBuf = Buffer.from(candidate);
  const expectedBuf = Buffer.from(APP_PASSWORD);
  if (candidateBuf.length !== expectedBuf.length) {
    // Still run a comparison against itself to keep timing consistent
    crypto.timingSafeEqual(expectedBuf, expectedBuf);
    return false;
  }
  return crypto.timingSafeEqual(candidateBuf, expectedBuf);
};
