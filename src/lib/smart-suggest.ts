import { db } from "@/lib/db";
import { projectAccessWhere, reportAccessWhere, type Viewer } from "@/lib/rbac";
import { similarityIndex, weightedEstimate, weightedVote, tokens } from "@/lib/similarity";
import { reportKindLabel } from "@/lib/report-kinds";

export type SuggestKind = "project" | "report";

export type Suggestion = {
  hoursSaved: { value: number; basedOn: string[] } | null;
  brand: { name: string; reason: string } | null;
  reportKind: { value: string; label: string } | null;
  similar: { title: string; href: string; score: number; type: string; status: string }[];
};

const DUPLICATE = 0.45;

/** Suggestions for a draft, drawn only from work this viewer can already see. */
export async function smartSuggest(
  viewer: Viewer,
  input: { kind: SuggestKind; text: string; excludeId?: string | null },
): Promise<Suggestion> {
  const text = input.text.slice(0, 4000);
  const empty: Suggestion = { hoursSaved: null, brand: null, reportKind: null, similar: [] };
  if (tokens(text).length === 0) return empty;
  const [projects, reports, enhancements, brands] = await Promise.all([
    db.project.findMany({
      where: { AND: [projectAccessWhere(viewer), input.excludeId ? { id: { not: input.excludeId } } : {}] },
      select: {
        id: true,
        title: true,
        summary: true,
        department: true,
        subTeam: true,
        status: true,
        savedHours: true,
        brand: { select: { name: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 2000,
    }),
    db.task.findMany({
      where: { AND: [reportAccessWhere(viewer), input.excludeId ? { id: { not: input.excludeId } } : {}] },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        kind: true,
        savedHours: true,
        brand: { select: { name: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 3000,
    }),
    db.enhancement.findMany({
      where: { project: projectAccessWhere(viewer), savedHours: { not: null } },
      select: { title: true, description: true, savedHours: true },
      take: 2000,
    }),
    db.brand.findMany({ select: { name: true } }),
  ]);

  type Item = {
    title: string;
    href: string;
    type: string;
    status: string;
    savedHours: number | null;
    brand: string | null;
    kind: string | null;
  };
  const docs: { text: string; item: Item }[] = [
    ...projects.map((p) => ({
      text: [p.title, p.title, p.summary, p.department, p.subTeam, p.brand?.name].filter(Boolean).join(" "),
      item: {
        title: p.title,
        href: `/dashboard/projects/${p.id}`,
        type: "Project",
        status: p.status,
        savedHours: p.savedHours,
        brand: p.brand?.name ?? null,
        kind: null,
      },
    })),
    ...reports.map((r) => ({
      text: [r.title, r.title, r.description, r.brand?.name].filter(Boolean).join(" "),
      item: {
        title: r.title,
        href: `/dashboard/reports/${r.id}`,
        type: reportKindLabel(r.kind),
        status: r.status,
        savedHours: r.savedHours,
        brand: r.brand?.name ?? null,
        kind: r.kind,
      },
    })),
    ...enhancements.map((e) => ({
      text: [e.title, e.title, e.description].filter(Boolean).join(" "),
      item: { title: e.title, href: "", type: "Enhancement", status: "", savedHours: e.savedHours, brand: null, kind: null },
    })),
  ];
  const index = similarityIndex(docs);
  const matches = index.rank(text, 12, 0.12);

  const withHours = matches.filter((m) => m.item.savedHours !== null && m.item.savedHours > 0).slice(0, 5);
  const hours = weightedEstimate(withHours.map((m) => ({ ...m, item: { value: m.item.savedHours ?? 0 } })));

  // A brand named in the text wins; otherwise similar work votes.
  const words = new Set(text.toLowerCase().split(/[^\p{L}\p{N}]+/u));
  const named = brands
    .filter((b) => b.name.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean).every((w) => words.has(w)))
    .sort((a, b) => b.name.length - a.name.length)[0];
  const brandVote = weightedVote(matches.slice(0, 6).map((m) => ({ ...m, item: { value: m.item.brand } })));
  const kindVote =
    input.kind === "report"
      ? weightedVote(matches.filter((m) => m.item.kind).slice(0, 6).map((m) => ({ ...m, item: { value: m.item.kind } })))
      : null;

  return {
    hoursSaved: hours === null ? null : { value: hours, basedOn: withHours.map((m) => m.item.title).slice(0, 3) },
    brand: named
      ? { name: named.name, reason: "named in the text" }
      : brandVote
        ? { name: brandVote.value, reason: "used by similar work" }
        : null,
    reportKind: kindVote ? { value: kindVote.value, label: reportKindLabel(kindVote.value) } : null,
    similar: matches
      .filter((m) => m.score >= DUPLICATE && m.item.href)
      .slice(0, 5)
      .map((m) => ({ title: m.item.title, href: m.item.href, score: Math.round(m.score * 100), type: m.item.type, status: m.item.status })),
  };
}
