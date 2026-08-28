import { defineConfig } from "drizzle-kit";
import dotenv from "dotenv";

// Load the same env file Next.js uses so credentials live in one place (.env.local).
dotenv.config({ path: ".env.local" });

const url = process.env.DATABASE_URL;

if (!url) {
  throw new Error("DATABASE_URL is required (set it in .env.local)");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  dbCredentials: {
    url,
    // Supabase pooler requires TLS; see src/db/index.ts.
    ssl: { rejectUnauthorized: false },
  },
});
