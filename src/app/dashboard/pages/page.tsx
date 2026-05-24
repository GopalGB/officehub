import Link from "next/link";
import { FileText } from "lucide-react";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { timeAgo } from "@/lib/utils";
import { NewPagePicker } from "@/components/pages/NewPagePicker";

export default async function PagesIndexPage() {
  const recent = await db.page.findMany({
    where: { archived: false },
    orderBy: { updatedAt: "desc" },
    take: 12,
    include: { author: { select: { name: true } } },
  });
  const total = await db.page.count({ where: { archived: false } });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Wiki</h1>
          <p className="text-sm text-slate-500">
            Free-form pages for docs, runbooks, SOPs, meeting notes — anything not project-specific.
          </p>
        </div>
        <NewPagePicker />
      </header>

      {total === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No pages yet</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-500">
            <p>Create your first page — a runbook, an onboarding doc, a meeting note.</p>
            <p className="mt-2">
              Use the tree on the left to navigate. Pages can have child pages (Notion-style).
            </p>
          </CardContent>
        </Card>
      ) : (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Recently updated
          </h2>
          <ul className="divide-y divide-slate-100 rounded-md border border-slate-200 bg-white">
            {recent.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/dashboard/pages/${p.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50"
                >
                  <div className="text-lg">
                    {p.emoji ? p.emoji : <FileText className="h-4 w-4 text-slate-400" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {p.title || "Untitled"}
                    </p>
                    <p className="text-xs text-slate-500">
                      Updated {timeAgo(p.updatedAt)} · by {p.author.name}
                    </p>
                  </div>
                  <Avatar name={p.author.name} size="sm" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
