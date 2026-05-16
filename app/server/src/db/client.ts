import { PrismaClient } from "@prisma/client";

// tsx watch re-executes modules on each file change. Without this singleton pattern,
// every hot-reload creates a new PrismaClient instance and exhausts the connection pool.
// Storing on globalThis persists the instance across module re-evaluations.
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ log: ["error"] });

if (process.env["NODE_ENV"] !== "production") globalForPrisma.prisma = prisma;
