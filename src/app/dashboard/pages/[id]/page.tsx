import { notFound } from "next/navigation";
import Link from "next/link";
import type { Block } from "@blocknote/core";
import { auth } from "../../../../../auth";
import { db } from "@/lib/db";
import { PageEditor } from "@/components/pages/PageEditor";
import { isManagerOrAbove } from "@/lib/rbac";

interface Crumb {
  id: string;
  title: string;
  emoji: string | null;
}

async function trail(pageId: string | null): Promise<Crumb[]> {
  const crumbs: Crumb[] = [];
  let cursor = pageId;
  while (cursor) {
    const p: { id: string; title: string; emoji: string | null; parentId: string | null } | null =
      await db.page.findUnique({
        where: { id: cursor },
        select: { id: true, title: true, emoji: true, parentId: true },
      });
    if (!p) break;
    crumbs.unshift({ id: p.id, title: p.title, emoji: p.emoji });
    cursor = p.parentId;
  }
  return crumbs;
}

export default async function PageDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return null;

  const page = await db.page.findUnique({
    where: { id },
    include: { author: { select: { id: true, name: true } } },
  });
  if (!page || page.archived) notFound();

  const crumbs = await trail(page.parentId);
  const canDelete = page.authorId === session.user.id || isManagerOrAbove(session.user.role);

  return (
    <div className="space-y-4">
      {crumbs.length > 0 && (
        <nav className="flex flex-wrap items-center gap-1 text-xs text-slate-500">
          <Link href="/dashboard/pages" className="hover:underline">
            Wiki
          </Link>
          {crumbs.map((c) => (
            <span key={c.id} className="flex items-center gap-1">
              <span>/</span>
              <Link href={`/dashboard/pages/${c.id}`} className="hover:underline">
                {c.emoji ? `${c.emoji} ` : ""}
                {c.title || "Untitled"}
              </Link>
            </span>
          ))}
        </nav>
      )}
      <PageEditor
        pageId={page.id}
        initialTitle={page.title}
        initialEmoji={page.emoji}
        initialContent={(page.content as Block[] | null) ?? null}
        canDelete={canDelete}
        updatedAt={page.updatedAt}
      />
    </div>
  );
}
