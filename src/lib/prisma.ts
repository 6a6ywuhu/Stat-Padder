import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { libsqlConfig } from "./libsql-config";

/**
 * The app talks to libSQL through the driver adapter. In production
 * `TURSO_DATABASE_URL` (libsql://…) + `TURSO_AUTH_TOKEN` point at Turso;
 * locally, with those unset, it falls back to a plain SQLite file so
 * `npm run dev` needs no external service.
 */
const adapter = new PrismaLibSQL(libsqlConfig());

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
