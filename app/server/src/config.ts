const required = (key: string): string => {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
};

export const DATABASE_URL = required("DATABASE_URL");
export const JWT_SECRET = required("JWT_SECRET");
export const APP_PASSWORD = required("APP_PASSWORD");
export const PORT = parseInt(process.env["PORT"] ?? "3001", 10);
export const NODE_ENV = process.env["NODE_ENV"] ?? "development";
export const CORS_ORIGIN = process.env["CORS_ORIGIN"] ?? "http://localhost:3001";
export const CLAUDE_BIN = process.env["CLAUDE_BIN"] ?? "/usr/local/bin/claude";
export const EXPIRY_WARN_DAYS = parseInt(process.env["EXPIRY_WARN_DAYS"] ?? "7", 10);
