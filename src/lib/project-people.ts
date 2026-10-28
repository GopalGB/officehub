import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

// Administrative accounts manage the workspace; they are not delivery staff.
export const assignablePeopleWhere = {
  active: true,
  role: { not: "ADMIN" },
} satisfies Prisma.UserWhereInput;

export async function assertAssignablePeople(
  ids: string[],
  client: Pick<Prisma.TransactionClient, "user"> = db,
) {
  const unique = [...new Set(ids)];
  if (!unique.length) return;
  const count = await client.user.count({
    where: { ...assignablePeopleWhere, id: { in: unique } },
  });
  if (count !== unique.length)
    throw new Error(
      "Choose active team members. Admin accounts cannot be allocated work.",
    );
}
