import { createHash } from "node:crypto";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { type Viewer, isManagerOrAbove } from "@/lib/rbac";
import { assertAssignablePeople } from "@/lib/project-people";
import { recordAudit, reviseProject, saveProjectRevision } from "@/lib/history";
import { additionalDetailsSchema } from "@/lib/additional-details";
import {
  importName,
  importOptionsSchema,
  importResultSchema,
  stagedRowsSchema,
  type ImportRow,
  type ImportPreview,
  type StagedRow,
} from "@/lib/project-import";

const importedChangesSchema = z.array(
  z.object({ index: z.number().int(), id: z.string() }),
);
type Actor = Viewer & { name?: string | null };
async function requireImportManager(
  actor: Actor,
  client: Pick<Prisma.TransactionClient, "user"> = db,
) {
  const user = await client.user.findUnique({
    where: { id: actor.id },
    select: { active: true, role: true },
  });
  if (
    !user?.active ||
    !isManagerOrAbove(user.role) ||
    !isManagerOrAbove(actor.role)
  )
    throw new Error("Only managers and administrators can import projects.");
}
function rowHash(row: ImportRow) {
  const { row: _row, ...contents } = row;
  void _row;
  return createHash("sha256").update(JSON.stringify(contents)).digest("hex");
}

export async function prepareProjectImport(
  actor: Actor,
  options: unknown,
  workbook: { fileName: string; sheetName: string; rows: ImportRow[] },
): Promise<ImportPreview> {
  await requireImportManager(actor);
  const parsed = importOptionsSchema.parse(options);
  await assertAssignablePeople([parsed.ownerId]);
  const source = `${importName(parsed.source)}::${importName(workbook.sheetName)}`;
  const [records, projects] = await Promise.all([
    db.projectImportRecord.findMany({
      where: { source },
      include: { project: { select: { id: true, version: true } } },
    }),
    db.project.findMany({ select: { id: true, title: true, version: true } }),
  ]);
  const byTitle = new Map<string, typeof projects>();
  for (const project of projects) {
    const key = importName(project.title);
    byTitle.set(key, [...(byTitle.get(key) ?? []), project]);
  }
  const rows = stagedRowsSchema.parse(
    workbook.rows.map((data): StagedRow => {
      const record = records.find((item) => item.recordKey === data.key);
      const matches = byTitle.get(importName(data.title)) ?? [];
      const project =
        record?.project ?? (matches.length === 1 ? matches[0] : null);
      const hash = rowHash(data);
      const conflict = record
        ? matches.some((match) => match.id !== record.project.id)
        : matches.length > 1;
      return {
        data,
        hash,
        projectId: project?.id ?? null,
        expectedVersion: project?.version ?? null,
        recordId: record?.id ?? null,
        disposition: conflict
          ? "conflict"
          : record?.importedHash === hash
            ? "unchanged"
            : project
              ? "update"
              : "create",
        note: conflict
          ? "This name matches another project; resolve duplicate names before importing this row."
          : record?.importedHash === hash
            ? "Already imported. Existing edits are preserved."
            : project
              ? "Existing project. Skipped unless updates are enabled below."
              : "New project. Dates are left unset.",
      };
    }),
  );
  const targets = rows.flatMap((row) => (row.projectId ? [row.projectId] : []));
  if (new Set(targets).size !== targets.length)
    throw new Error(
      "Several workbook rows match the same existing project. Give each project a distinct name/reference.",
    );
  const draft = await db.projectImport.create({
    data: {
      actorId: actor.id,
      ownerId: parsed.ownerId,
      source,
      fileName: workbook.fileName.slice(0, 200),
      sheetName: workbook.sheetName,
      rows,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });
  // Clear this actor's expired previews; they are never used to store attachments.
  await db.projectImport.deleteMany({
    where: {
      actorId: actor.id,
      expiresAt: { lt: new Date() },
      appliedAt: null,
    },
  });
  return {
    id: draft.id,
    ownerId: draft.ownerId,
    fileName: draft.fileName,
    sheetName: draft.sheetName,
    rows,
    savedHours: rows.reduce((sum, row) => sum + (row.data.savedHours ?? 0), 0),
    changes: rows.reduce((sum, row) => sum + row.data.changes.length, 0),
  };
}

export async function applyProjectImport(
  actor: Actor,
  importId: string,
  updateExisting: boolean,
) {
  await requireImportManager(actor);
  return db.$transaction(
    async (tx) => {
      await requireImportManager(actor, tx);
      const draft = await tx.projectImport.findUnique({
        where: { id: importId },
      });
      if (!draft || draft.actorId !== actor.id)
        throw new Error("Import preview is unavailable.");
      if (draft.appliedAt) return importResultSchema.parse(draft.result);
      if (draft.expiresAt < new Date())
        throw new Error("This preview expired. Upload the workbook again.");
      const rows = stagedRowsSchema.parse(draft.rows);
      const result = { created: 0, updated: 0, skipped: 0, changesAdded: 0 };
      const titles = await tx.project.findMany({
        select: { id: true, title: true },
      });
      if (rows.some((row) => row.disposition === "create"))
        await assertAssignablePeople([draft.ownerId], tx);
      for (const row of rows) {
        if (
          row.disposition === "unchanged" ||
          row.disposition === "conflict" ||
          (row.disposition === "update" && !updateExisting)
        ) {
          result.skipped++;
          continue;
        }
        const currentRecord = await tx.projectImportRecord.findUnique({
          where: {
            source_recordKey: { source: draft.source, recordKey: row.data.key },
          },
        });
        if ((currentRecord?.id ?? null) !== row.recordId)
          throw new Error(
            "Import records changed after preview. Upload again before saving.",
          );
        if (
          titles.some(
            (item) =>
              item.id !== row.projectId &&
              importName(item.title) === importName(row.data.title),
          )
        )
          throw new Error(
            `“${row.data.title}” now matches another project. Upload again before saving.`,
          );
        let project;
        const values = {
          title: row.data.title,
          ...(row.data.status && { status: row.data.status }),
          ...(row.data.priority && { priority: row.data.priority }),
          ...(row.data.projectType && { projectType: row.data.projectType }),
          ...(row.data.savedHours !== undefined && {
            savedHours: row.data.savedHours,
          }),
          ...(row.data.department && { department: row.data.department }),
          ...(row.data.subTeam && { subTeam: row.data.subTeam }),
        };
        if (row.projectId) {
          const before = await tx.project.findUnique({
            where: { id: row.projectId },
          });
          if (!before || before.version !== row.expectedVersion)
            throw new Error(
              `“${row.data.title}” changed after preview. Upload again before saving.`,
            );
          const existingFields = additionalDetailsSchema.parse(
            before.additionalDetails,
          );
          const merged = [...existingFields];
          for (const field of row.data.additionalDetails) {
            const index = merged.findIndex(
              (item) => importName(item.label) === importName(field.label),
            );
            if (index < 0) merged.push(field);
            else if (field.value.trim()) merged[index] = field;
          }
          const additionalDetails = additionalDetailsSchema.parse(merged);
          project = await reviseProject(
            tx,
            actor,
            before.id,
            {
              ...values,
              additionalDetails,
              // The workbook has no delivery dates. Never turn import time into completion time.
              actualEndDate: before.actualEndDate,
            },
            "Project updated from Excel",
            row.expectedVersion ?? undefined,
          );
          result.updated++;
        } else {
          project = await tx.project.create({
            data: {
              ...values,
              ownerId: draft.ownerId,
              additionalDetails: row.data.additionalDetails,
              status: values.status ?? "PLANNING",
              priority: values.priority ?? "MEDIUM",
              actualEndDate: null,
            },
          });
          await saveProjectRevision(
            tx,
            project.id,
            actor,
            "Project imported from Excel",
          );
          await recordAudit(
            tx,
            actor,
            "Project imported from Excel",
            "Project",
            project.id,
            project.id,
            null,
            project,
          );
          result.created++;
        }
        const titleIndex = titles.findIndex((item) => item.id === project.id);
        if (titleIndex < 0)
          titles.push({ id: project.id, title: project.title });
        else titles[titleIndex] = { id: project.id, title: project.title };
        const importedChanges = importedChangesSchema.parse(
          currentRecord?.enhancements ?? [],
        );
        const existingChanges = await tx.enhancement.findMany({
          where: { projectId: project.id },
          select: { id: true, title: true },
        });
        for (const [index, change] of row.data.changes.entries()) {
          // Imports append newly recorded iterations. Existing timeline edits are kept.
          if (importedChanges.some((item) => item.index === index)) continue;
          let enhancement = existingChanges.find(
            (item) => importName(item.title) === importName(change.title),
          );
          if (!enhancement) {
            enhancement = await tx.enhancement.create({
              data: {
                projectId: project.id,
                authorId: actor.id,
                ...change,
                priority: row.data.priority ?? "MEDIUM",
                status: row.data.status === "COMPLETED" ? "DONE" : "PROPOSED",
              },
            });
            await recordAudit(
              tx,
              actor,
              "Recorded enhancement imported from Excel",
              "Enhancement",
              enhancement.id,
              project.id,
              null,
              enhancement,
            );
            existingChanges.push(enhancement);
            result.changesAdded++;
          }
          importedChanges.push({ index, id: enhancement.id });
        }
        await tx.projectImportRecord.upsert({
          where: {
            source_recordKey: { source: draft.source, recordKey: row.data.key },
          },
          create: {
            source: draft.source,
            recordKey: row.data.key,
            projectId: project.id,
            importedHash: row.hash,
            enhancements: importedChanges,
          },
          update: { importedHash: row.hash, enhancements: importedChanges },
        });
      }
      await tx.projectImport.update({
        where: { id: draft.id, appliedAt: null },
        data: { appliedAt: new Date(), result },
      });
      return result;
    },
    { isolationLevel: "Serializable", timeout: 30000 },
  );
}
