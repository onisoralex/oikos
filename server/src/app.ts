import express from "express";
import cors from "cors";
import helmet from "helmet";
import { CORS_ORIGIN } from "./config.js";
import { authMiddleware } from "./middleware/auth.js";
import { errorHandler } from "./middleware/errorHandler.js";
import authRoutes from "./modules/auth/auth.routes.js";
import pantryRoutes from "./modules/pantry/pantry.routes.js";

const app = express();

// contentSecurityPolicy disabled: Vite HMR injects inline scripts and workers at runtime,
// which CSP's default-src/script-src restrictions would block in development.
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", ts: new Date().toISOString() });
});

app.use("/api/auth", authRoutes);
app.use("/api/v1/pantry", authMiddleware, pantryRoutes);

app.use(errorHandler);

export default app;
