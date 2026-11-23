import type { Prisma } from "@prisma/client";
import { z } from "zod";

export const brandNameSchema = z
  .string()
  .trim()
  .max(60, "Brand names are limited to 60 characters");

/** The brand text box: absent keeps the current brand, blank clears it, and a
 * new name creates the brand so nobody needs a separate setup screen. */
export async function resolveBrandId(
  tx: Pick<Prisma.TransactionClient, "brand">,
  fd: FormData,
): Promise<string | null | undefined> {
  if (!fd.has("brand")) return undefined;
  const name = brandNameSchema.parse(fd.get("brand") ?? "");
  if (!name) return null;
  const existing = await tx.brand.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) return existing.id;
  const created = await tx.brand.upsert({
    where: { name },
    create: { name },
    update: {},
    select: { id: true },
  });
  return created.id;
}

export async function listBrandNames(
  client: Pick<Prisma.TransactionClient, "brand">,
) {
  const brands = await client.brand.findMany({
    select: { name: true },
    orderBy: { name: "asc" },
  });
  return brands.map((b) => b.name);
}
