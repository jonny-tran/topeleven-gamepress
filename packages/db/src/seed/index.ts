import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { user, account } from "../schema/auth";
import { hashPassword } from "../password";
import { config } from "dotenv";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

// Resolve repo root reliably whether the script runs from repo root
// (`bun db:seed`) or from inside `packages/db`.
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..", "..");

// Load env from apps/server/.env
config({ path: join(repoRoot, "apps/server/.env") });

// Clean DATABASE_URL: remove 'psql ' prefix, quotes, and channel_binding parameter
const rawUrl = process.env.DATABASE_URL || "";
const cleanUrl = rawUrl
  .replace(/^psql\s*/, "") // remove 'psql ' prefix
  .replace(/^'/, "") // remove leading quote
  .replace(/'$/, "") // remove trailing quote
  .replace(/[?&]channel_binding=require/, ""); // remove channel_binding param

const DATABASE_URL = cleanUrl;
const PASSWORD_ADMIN = process.env.PASSWORD_ADMIN;

if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set in .env");
  process.exit(1);
}

if (!PASSWORD_ADMIN) {
  console.error("PASSWORD_ADMIN is not set in .env");
  process.exit(1);
}

const ADMIN_USERS = [
  { name: "Admin 1", email: "admin1@example.com", username: "admin1" },
  { name: "Admin 2", email: "admin2@example.com", username: "admin2" },
  { name: "Admin 3", email: "admin3@example.com", username: "admin3" },
  { name: "Admin 4", email: "admin4@example.com", username: "admin4" },
  { name: "Admin 5", email: "admin5@example.com", username: "admin5" },
];

function generateId(): string {
  return `user_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

async function seed() {
  console.log("🔄 Connecting to database...");
  const sql = neon(DATABASE_URL);
  const db = drizzle(sql);

  // Reset: delete existing admin users
  console.log("🗑️  Resetting existing users...");
  for (const admin of ADMIN_USERS) {
    await sql`DELETE FROM "account" WHERE "account_id" = ${admin.username}`;
    await sql`DELETE FROM "user" WHERE "email" = ${admin.email}`;
  }

  console.log("🔐 Hashing password...");
  const hashedPassword = await hashPassword(PASSWORD_ADMIN || "");

  console.log("📝 Creating admin users...");

  for (const admin of ADMIN_USERS) {
    const userId = generateId();

    // Check if user already exists using raw SQL
    const existingUsers = await sql`SELECT id FROM "user" WHERE email = ${admin.email}`;

    if (existingUsers.length > 0) {
      console.log(`⏭️  User ${admin.username} already exists, skipping...`);
      continue;
    }

    // Create user
    await db.insert(user).values({
      id: userId,
      name: admin.name,
      email: admin.email,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create account with credential provider
    // NOTE: better-auth expects:
    // - issuer = "local:credential" (created by createLocalAccountIssuer("credential"))
    // - accountId = user.id (NOT the username)
    // - providerId = "credential"
    await db.insert(account).values({
      id: generateId(),
      issuer: "local:credential",
      accountId: userId, // must be user.id, not username
      providerId: "credential",
      userId: userId,
      password: hashedPassword,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log(`✅ Created user: ${admin.username} (${admin.email})`);
  }

  console.log("✨ Seed completed!");
}

seed().catch(console.error);
