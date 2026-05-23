import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { timeAgo } from "@/lib/utils";

interface ActivityItem {
  id: string;
  kind: "update" | "comment" | "enhancement" | "milestone";
  projectId: string;
  projectTitle: string;
  authorName: string;
  summary: string;
  createdAt: Date;
}

const KIND_LABEL: Record<ActivityItem["kind"], string> = {
  update: "posted a status update on",
  comment: "commented on",
  enhancement: "proposed an enhancement on",
  milestone: "added a milestone to",
};

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-400">Quiet for now — no recent team activity.</p>;
  }
  return (
    <ul className="divide-y divide-slate-100 rounded-md border border-slate-200 bg-white">
      {items.map((a) => (
        <li key={`${a.kind}-${a.id}`} className="flex items-start gap-3 px-4 py-3">
          <Avatar name={a.authorName} size="sm" />
          <div className="min-w-0 flex-1 text-sm">
            <p className="text-slate-700">
              <span className="font-medium">{a.authorName}</span>{" "}
              <span className="text-slate-500">{KIND_LABEL[a.kind]}</span>{" "}
              <Link
                href={`/dashboard/projects/${a.projectId}`}
                className="font-medium text-slate-900 hover:underline"
              >
                {a.projectTitle}
              </Link>
            </p>
            {a.summary && <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{a.summary}</p>}
          </div>
          <span className="shrink-0 text-xs text-slate-400">{timeAgo(a.createdAt)}</span>
        </li>
      ))}
    </ul>
  );
}
