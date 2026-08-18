import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// Next.js sam ucitava .env.local, ali Prisma CLI ne — zato ga ucitavamo ovde,
// da konekcioni string ima samo jedan izvor istine.
loadEnv({ path: ".env.local", quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    // Pokrece se posle `prisma migrate reset`, i rucno kroz `npm run db:seed`.
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
