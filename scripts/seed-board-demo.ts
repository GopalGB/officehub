// Dev-only: populates the board with sample projects + tasks across every column
// so drag-and-drop can be exercised locally. Safe to re-run (idempotent-ish by title).
// Run: npx tsx scripts/seed-board-demo.ts
import bcrypt from "bcryptjs";
import { PrismaClient, type ProjectStatus, type TaskStatus } from "@prisma/client";

const db = new PrismaClient();
const STEP = 1024;

async function ensureUser(email: string, name: string, role: "ADMIN" | "MANAGER" | "MEMBER") {
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return existing;
  const passwordHash = await bcrypt.hash("ChangeMe!Now1234", 12);
  return db.user.create({ data: { email, name, passwordHash, role } });
}

async function main() {
  const admin = await ensureUser("admin@office.local", "Office Admin", "ADMIN");
  const manager = await ensureUser("manager@office.local", "Maya Manager", "MANAGER");
  const member = await ensureUser("member@office.local", "Milo Member", "MEMBER");

  const projStatuses: ProjectStatus[] = ["PLANNING", "IN_PROGRESS", "BLOCKED", "ON_HOLD", "COMPLETED"];
  const owners = [admin, manager, member];

  let projCount = 0;
  for (const status of projStatuses) {
    for (let i = 0; i < 3; i++) {
      const title = `${status} project ${i + 1}`;
      const exists = await db.project.findFirst({ where: { title } });
      if (exists) continue;
      await db.project.create({
        data: {
          title,
          summary: `Sample ${status.toLowerCase()} project for drag testing`,
          status,
          priority: (["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const)[i % 4],
          ownerId: owners[i % owners.length].id,
          orderIndex: i * STEP,
          targetDate: i === 0 ? new Date(Date.now() - 86400000) : new Date(Date.now() + i * 86400000),
        },
      });
      projCount++;
    }
  }

  // One project to host tasks
  const taskHost =
    (await db.project.findFirst({ where: { title: "IN_PROGRESS project 1" } })) ??
    (await db.project.findFirst());
  if (!taskHost) throw new Error("No project to attach tasks");

  const taskStatuses: TaskStatus[] = ["TODO", "IN_PROGRESS", "IN_REVIEW", "BLOCKED", "DONE"];
  let taskCount = 0;
  for (const status of taskStatuses) {
    for (let i = 0; i < 3; i++) {
      const title = `${status} task ${i + 1}`;
      const exists = await db.task.findFirst({ where: { title, projectId: taskHost.id } });
      if (exists) continue;
      await db.task.create({
        data: {
          projectId: taskHost.id,
          title,
          status,
          priority: (["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const)[i % 4],
          storyPoints: (i + 1) * 2,
          reporterId: admin.id,
          assigneeId: [admin, manager, member][i % 3].id,
          orderIndex: i * STEP,
          dueDate: i === 0 ? new Date(Date.now() - 86400000) : new Date(Date.now() + i * 86400000),
        },
      });
      taskCount++;
    }
  }

  const totals = {
    users: await db.user.count(),
    projects: await db.project.count(),
    tasks: await db.task.count(),
    createdProjects: projCount,
    createdTasks: taskCount,
  };
  console.log(JSON.stringify(totals, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
