// Applies SQL migrations in ./drizzle to the database. Runs automatically during `npm run build` on Vercel.
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) {
  if (process.env.SKIP_MIGRATIONS) { console.log("Skipping migrations (SKIP_MIGRATIONS set)."); process.exit(0); }
  console.error("\n✖ DATABASE_URL is not set. Connect a Postgres database (Vercel → Storage → Neon) and redeploy.\n");
  process.exit(1);
}
const local = /localhost|127\.0\.0\.1/.test(url);
const pool = new pg.Pool({ connectionString: url, max: 1, ssl: local ? undefined : { rejectUnauthorized: false } });
try {
  await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
  console.log("✓ Database migrations applied");
} catch (e) {
  console.error("✖ Migration failed:", e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
