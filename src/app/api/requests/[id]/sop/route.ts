import { db } from "@/lib/db";
import { requireApiAuth, jsonError } from "@/lib/api";
import { canViewProject, isManagerOrAbove } from "@/lib/rbac";
import { idSchema } from "@/lib/validation";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { user, response } = await requireApiAuth();
  if (response) return response;
  const { id } = await ctx.params;
  if (!idSchema.safeParse(id).success)
    return jsonError("NOT_FOUND", "SOP not found", 404);
  // Authorize against metadata before loading any file bytes.
  const request = await db.projectRequest.findUnique({
    where: { id },
    select: {
      project: {
        select: {
          ownerId: true,
          coOwnerId: true,
          members: { select: { id: true } },
        },
      },
    },
  });
  if (!request) return jsonError("NOT_FOUND", "SOP not found", 404);
  if (
    !isManagerOrAbove(user.role) &&
    !(
      request.project &&
      canViewProject({
        viewerId: user.id,
        viewerRole: user.role,
        ownerId: request.project.ownerId,
        coOwnerId: request.project.coOwnerId,
        memberIds: request.project.members.map((member) => member.id),
      })
    )
  )
    return jsonError(
      "FORBIDDEN",
      "This SOP is available to managers and the assigned project team",
      403,
    );
  const file = await db.projectRequest.findUnique({
    where: { id },
    select: { sopFileData: true, sopFileName: true },
  });
  if (!file?.sopFileData || !file.sopFileName)
    return jsonError("NOT_FOUND", "No SOP was uploaded", 404);
  const filename = encodeURIComponent(file.sopFileName).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return new Response(new Uint8Array(file.sopFileData), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="sop"; filename*=UTF-8''${filename}`,
      "Content-Length": String(file.sopFileData.length),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
