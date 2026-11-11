// Emergency/CLI way to create or reset an admin:
//   DATABASE_URL=... node scripts/create-admin.mjs "Your Name" you@company.com "a-strong-password"
import pg from "pg";
import bcrypt from "bcryptjs";

const [name, email, password] = process.argv.slice(2);
if (!name || !email || !password || password.length < 10) {
  console.error('Usage: node scripts/create-admin.mjs "Name" email@company.com "password (10+ chars)"');
  process.exit(1);
}
const url = process.env.DATABASE_URL;
if (!url) { console.error("Set DATABASE_URL first."); process.exit(1); }
const local = /localhost|127\.0\.0\.1/.test(url);
const client = new pg.Client({ connectionString: url, ssl: local ? undefined : { rejectUnauthorized: false } });
await client.connect();
const hash = await bcrypt.hash(password, 12);
await client.query(
  `INSERT INTO users (id, name, email, password_hash, role, department, active)
   VALUES ($1,$2,$3,$4,'ADMIN','Management',true)
   ON CONFLICT (email) DO UPDATE SET password_hash=EXCLUDED.password_hash, role='ADMIN', active=true,
     session_version = users.session_version + 1`,
  [crypto.randomUUID(), name, email.trim().toLowerCase(), hash],
);
console.log(`✓ Admin ready: ${email}`);
await client.end();
