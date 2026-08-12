import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";
import { env, isDev } from "@/lib/env";

/**
 * Prisma klijent kao singleton.
 *
 * U dev-u Next.js hot-reload izvrsava modul iznova na svaku izmenu; bez kesiranja
 * na globalThis svaki reload bi otvorio novi pool konekcija i brzo iscrpeo bazu.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient(): PrismaClient {
  // Prisma 7 ide preko driver adaptera — nema vise ugradjenog Rust engine-a.
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

  return new PrismaClient({
    adapter,
    log: isDev ? ["query", "warn", "error"] : ["error"],
  });
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();

if (isDev) {
  globalForPrisma.prisma = prisma;
}
