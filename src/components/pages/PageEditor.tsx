"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Block } from "@blocknote/core";
import { Trash2 } from "lucide-react";
import { BlockEditor } from "@/components/editor/BlockEditor";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { archivePage, savePage } from "@/app/dashboard/actions";
import { pageSaveSchema } from "@/lib/validation";
import { useToast } from "@/components/ui/toast";

type Draft = { title: string; emoji: string; content: Block[] | null };

export function PageEditor({ pageId, viewerId, initialTitle, initialEmoji, initialContent, canEdit, canDelete, updatedAt }: {
  pageId: string; viewerId: string; initialTitle: string; initialEmoji: string | null;
  initialContent: Block[] | null; canEdit: boolean; canDelete: boolean; updatedAt: Date | string;
}) {
  const initial = { title: initialTitle, emoji: initialEmoji ?? "", content: initialContent };
  const [draft, setDraft] = useState<Draft>(initial);
  const latest = useRef<Draft>(initial);
  const version = useRef(new Date(updatedAt).toISOString());
  const revision = useRef(0);
  const savedRevision = useRef(0);
  const inFlight = useRef<Promise<boolean> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const conflict = useRef(false);
  const [recovery, setRecovery] = useState<Draft | null>(null);
  const [editorRevision, setEditorRevision] = useState(0);
  const [pending, start] = useTransition();
  const router = useRouter();
  const { toast } = useToast();
  const storageKey = `officehub:draft:${viewerId}:${pageId}`;

  const flush = useCallback(async (): Promise<boolean> => {
    if (!canEdit || conflict.current) return false;
    if (inFlight.current) return inFlight.current;
    const operation = async () => {
      setSaving(true);
      try {
        while (savedRevision.current !== revision.current) {
          const savingRevision = revision.current;
          const result = await savePage(pageId, { ...latest.current, expectedUpdatedAt: version.current });
          if ("error" in result) {
            conflict.current = result.conflict;
            setError(result.error);
            return false;
          }
          version.current = result.updatedAt;
          savedRevision.current = savingRevision;
        }
        setDirty(false);
        setError(null);
        try { localStorage.removeItem(storageKey); } catch { /* Storage may be disabled. */ }
        return true;
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not save. Your draft is kept on this device.");
        return false;
      } finally {
        setSaving(false);
      }
    };
    inFlight.current = operation();
    try { return await inFlight.current; } finally { inFlight.current = null; }
  }, [canEdit, pageId, storageKey]);

  function change(next: Draft) {
    if (!canEdit) return;
    latest.current = next;
    revision.current += 1;
    setDraft(next);
    setDirty(true);
    try {
      localStorage.setItem(storageKey, JSON.stringify({ ...next, expectedUpdatedAt: version.current }));
    } catch {
      setError("Draft storage is unavailable. Save before leaving this page.");
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void flush(); }, 500);
  }

  useEffect(() => {
    if (!canEdit) return;
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "null");
      const parsed = pageSaveSchema.safeParse(stored);
      if (parsed.success) setRecovery({ ...parsed.data, emoji: parsed.data.emoji ?? "", content: parsed.data.content as Block[] | null });
    } catch { /* Invalid or unavailable local storage is ignored. */ }
  }, [canEdit, storageKey]);

  useEffect(() => {
    if (!canEdit) return;
    function beforeUnload(event: BeforeUnloadEvent) {
      if (revision.current === savedRevision.current) return;
      event.preventDefault();
      event.returnValue = "";
    }
    function navigate(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest("a") : null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download") || anchor.origin !== location.origin || anchor.href === location.href) return;
      if (revision.current === savedRevision.current) return;
      event.preventDefault();
      event.stopPropagation();
      void flush().then((saved) => {
        if (saved) router.push(anchor.href);
      });
    }
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", navigate, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", navigate, true);
      if (timer.current) clearTimeout(timer.current);
      // Back/forward and abrupt tab closure can interrupt requests. The local
      // draft is written synchronously on every edit and is recoverable on return.
      void flush();
    };
  }, [canEdit, flush, router]);

  function onDelete() {
    if (!confirm("Archive this page? It will be hidden from the wiki.")) return;
    start(async () => {
      try {
        if (dirty && !await flush()) return;
        await archivePage(pageId);
      } catch (cause) {
        toast(cause instanceof Error ? cause.message : "Could not archive page", "error");
      }
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {recovery && canEdit && (
        <div role="status" className="rounded border p-3 text-sm dark:border-neutral-600">
          An unsaved draft is available on this device.
          <Button type="button" variant="outline" size="sm" onClick={() => {
            change(recovery); setRecovery(null); setEditorRevision((value) => value + 1);
          }}>Restore draft</Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => {
            try { localStorage.removeItem(storageKey); } catch { /* Storage may be disabled. */ }
            setRecovery(null);
          }}>Discard draft</Button>
        </div>
      )}
      <div className="flex items-start gap-3">
        <input aria-label="Page icon" value={draft.emoji} disabled={!canEdit}
          onChange={(event) => change({ ...latest.current, emoji: event.target.value.slice(0, 8) })}
          onBlur={() => { if (dirty) void flush(); }} placeholder="📄"
          className="h-12 w-14 rounded border border-transparent bg-transparent text-center text-3xl hover:border-slate-200 focus:border-slate-300 focus:outline-none" />
        <Input aria-label="Page title" value={draft.title} disabled={!canEdit}
          onChange={(event) => change({ ...latest.current, title: event.target.value })}
          onBlur={() => { if (dirty) void flush(); }} placeholder="Untitled"
          className="h-12 border-none bg-transparent px-2 text-3xl font-semibold focus-visible:ring-0" />
        {canDelete && <Button aria-label="Archive page" type="button" variant="ghost" size="sm" disabled={pending} onClick={onDelete}><Trash2 className="h-4 w-4" /></Button>}
      </div>
      <div aria-live="polite" className="flex flex-wrap items-center gap-2 px-2 text-xs text-slate-500 dark:text-slate-400">
        {!canEdit ? "Read only" : error ? <span role="alert">{error}</span> : saving ? "Saving…" : dirty ? "Unsaved changes" : "Saved"}
        {canEdit && dirty && <Button type="button" size="sm" variant="outline" disabled={saving} onClick={() => { void flush(); }}>Save now</Button>}
        {conflict.current && <Button type="button" size="sm" variant="outline" onClick={() => {
          savedRevision.current = revision.current; window.location.reload();
        }}>Reload latest</Button>}
      </div>
      <BlockEditor key={editorRevision} initialContent={draft.content} editable={canEdit}
        onChange={(content) => change({ ...latest.current, content })} />
    </div>
  );
}
