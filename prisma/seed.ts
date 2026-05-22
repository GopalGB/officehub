import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const email = (process.env.SEED_ADMIN_EMAIL ?? "admin@office.local").toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe!Now1234";
  const name = process.env.SEED_ADMIN_NAME ?? "Office Admin";

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`[seed] Admin '${email}' already exists. Skipping.`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await db.user.create({
    data: { email, name, passwordHash, role: "ADMIN" },
  });

  console.log(`[seed] Created admin: ${user.email} (id=${user.id})`);
  console.log(`[seed] Temporary password: ${password}`);
  console.log(`[seed] Change it from /dashboard/settings after first sign-in.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
