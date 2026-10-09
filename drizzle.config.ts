import { config } from "dotenv";

import { defineConfig } from "drizzle-kit";

config({ path: ".env.local", quiet: true });

// drizzle-kit legge DATABASE_URL da .env.local.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  casing: "snake_case",
  strict: true,
  verbose: true,
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
  migrations: { table: "__drizzle_migrations", schema: "public" },
});
