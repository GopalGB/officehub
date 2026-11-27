import { auth } from "../../../../auth";
import { db } from "@/lib/db";
import { isManagerOrAbove } from "@/lib/rbac";
import { submitFeedback, respondFeedback } from "@/app/dashboard/actions";
import { ActionForm } from "@/components/ui/action-form";
import { timeAgo } from "@/lib/utils";

const CATEGORIES = [
  { value: "IDEA", label: "Idea" },
  { value: "BUG", label: "Something is broken" },
  { value: "PRAISE", label: "What works well" },
  { value: "OTHER", label: "Other" },
];
const STATUSES = [
  { value: "NEW", label: "New" },
  { value: "PLANNED", label: "Planned" },
  { value: "DONE", label: "Done" },
  { value: "CLOSED", label: "Closed" },
];

export default async function FeedbackPage() {
  const session = await auth();
  if (!session?.user) return null;
  const manager = isManagerOrAbove(session.user.role);
  const items = await db.feedback.findMany({
    where: manager ? {} : { authorId: session.user.id },
    include: { author: { select: { name: true } } },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 300,
  });
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <p className="eyebrow">Resources / Feedback</p>
        <h1 className="page-title">Feedback on the project tracker</h1>
        <p className="page-subtitle">
          Tell us what to improve, what is broken or what works well.{" "}
          {manager ? "You can see everyone's feedback and reply." : "Managers read every message and reply here."}
        </p>
      </header>
      <div className="grid items-start gap-6 lg:grid-cols-[360px_1fr]">
        <section className="surface">
          <h2 className="section-title">Send feedback</h2>
          <ActionForm action={submitFeedback} label="Send feedback" successMessage="Thanks! Your feedback was sent." className="mt-3 space-y-3">
            <label className="field">
              Type
              <select name="category" defaultValue="IDEA">
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Which part (optional)
              <input name="area" maxLength={100} placeholder="e.g. Reports, My week, Calendar" />
            </label>
            <label className="field">
              Your feedback
              <textarea name="message" required minLength={5} maxLength={3000} rows={5} />
            </label>
            <label className="field">
              How useful is the tracker for you? (optional)
              <select name="rating" defaultValue="">
                <option value="">No rating</option>
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {"★".repeat(n)} ({n})
                  </option>
                ))}
              </select>
            </label>
          </ActionForm>
        </section>
        <section className="space-y-3">
          <h2 className="section-title">{manager ? "All feedback" : "Your feedback"} · {items.length}</h2>
          {items.map((f) => (
            <article key={f.id} className="surface !p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>
                  <span className="pill mr-2">{CATEGORIES.find((c) => c.value === f.category)?.label}</span>
                  {f.area && `${f.area} · `}
                  {manager ? `${f.author.name} · ` : ""}
                  {timeAgo(f.createdAt)}
                  {f.rating ? ` · ${"★".repeat(f.rating)}` : ""}
                </span>
                <span className="font-semibold text-brand-navy">{STATUSES.find((s) => s.value === f.status)?.label}</span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm">{f.message}</p>
              {f.response && (
                <p className="mt-3 rounded-lg bg-brand-tint p-3 text-sm text-brand-navy">
                  <strong>Reply:</strong> {f.response}
                </p>
              )}
              {manager && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs text-brand-link">Reply / update status</summary>
                  <ActionForm action={respondFeedback.bind(null, f.id)} label="Save" successMessage="Saved." className="mt-3 space-y-3">
                    <label className="field">
                      Status
                      <select name="status" defaultValue={f.status}>
                        {STATUSES.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      Reply
                      <textarea name="response" rows={2} maxLength={2000} defaultValue={f.response ?? ""} />
                    </label>
                  </ActionForm>
                </details>
              )}
            </article>
          ))}
          {!items.length && <p className="surface text-sm text-muted-foreground">No feedback yet.</p>}
        </section>
      </div>
    </div>
  );
}
