import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
    // Only `migrate dev` and `migrate diff --from-migrations` need this — they
    // replay the migrations directory into a throwaway database. Read directly
    // rather than through env() so it stays optional: env() throws when unset,
    // which breaks `prisma generate`, `npm run build` and `migrate deploy`.
    ...(process.env.SHADOW_DATABASE_URL
      ? { shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL }
      : {}),
  },
});
