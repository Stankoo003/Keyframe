import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// Next.js sam ucitava .env.local, ali Prisma CLI ne — zato ga ucitavamo ovde,
// da konekcioni string ima samo jedan izvor istine.
loadEnv({ path: ".env.local", quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
