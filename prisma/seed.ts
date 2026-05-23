import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function seedAdmin() {
  const email = (process.env.SEED_ADMIN_EMAIL ?? "admin@office.local").toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe!Now1234";
  const name = process.env.SEED_ADMIN_NAME ?? "Office Admin";

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`[seed] Admin '${email}' already exists. Skipping admin create.`);
    return;
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await db.user.create({
    data: { email, name, passwordHash, role: "ADMIN" },
  });
  console.log(`[seed] Created admin: ${user.email}`);
  console.log(`[seed] Temporary password: ${password}`);
  console.log(`[seed] Change it from /dashboard/settings after first sign-in.`);
}

async function seedTags() {
  const starterTags = [
    { name: "Engineering", color: "#3b82f6" },
    { name: "Design", color: "#ec4899" },
    { name: "Marketing", color: "#f97316" },
    { name: "Ops", color: "#22c55e" },
    { name: "Customer", color: "#8b5cf6" },
    { name: "Quick win", color: "#eab308" },
  ];
  let created = 0;
  for (const t of starterTags) {
    const result = await db.tag.upsert({
      where: { name: t.name },
      update: {},
      create: t,
    });
    if (result) created++;
  }
  console.log(`[seed] Tags ensured: ${created}/${starterTags.length}`);
}

async function main() {
  await seedAdmin();
  await seedTags();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
