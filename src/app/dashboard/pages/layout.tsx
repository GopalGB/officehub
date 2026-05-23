import { db } from "@/lib/db";
import { PageTree, type PageNode } from "@/components/pages/PageTree";

interface RawPage {
  id: string;
  title: string;
  emoji: string | null;
  parentId: string | null;
  orderIndex: number;
}

function toTree(rows: RawPage[]): PageNode[] {
  const byId = new Map<string, PageNode>();
  rows.forEach((r) =>
    byId.set(r.id, { id: r.id, title: r.title, emoji: r.emoji, children: [] }),
  );
  const roots: PageNode[] = [];
  for (const r of rows) {
    const node = byId.get(r.id)!;
    if (r.parentId && byId.has(r.parentId)) {
      byId.get(r.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

export default async function PagesLayout({ children }: { children: React.ReactNode }) {
  const pages = await db.page.findMany({
    where: { archived: false },
    orderBy: [{ orderIndex: "asc" }, { title: "asc" }],
    select: { id: true, title: true, emoji: true, parentId: true, orderIndex: true },
  });
  const tree = toTree(pages);

  return (
    <div className="-m-4 flex h-[calc(100vh-3.5rem)] md:-m-6">
      <aside className="hidden w-64 shrink-0 overflow-y-auto border-r border-slate-200 bg-white p-3 md:block">
        <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Wiki pages
        </h2>
        <PageTree nodes={tree} />
      </aside>
      <main className="min-w-0 flex-1 overflow-y-auto p-4 md:p-8">{children}</main>
    </div>
  );
}
