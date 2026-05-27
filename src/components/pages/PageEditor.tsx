"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { Block } from "@blocknote/core";
import { Trash2 } from "lucide-react";
import { BlockEditor } from "@/components/editor/BlockEditor";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { archivePage, savePageContent, updatePage } from "@/app/dashboard/actions";
import { useToast } from "@/components/ui/toast";

export function PageEditor({
  pageId,
  initialTitle,
  initialEmoji,
  initialContent,
  canDelete,
  updatedAt,
}: {
  pageId: string;
  initialTitle: string;
  initialEmoji: string | null;
  initialContent: Block[] | null;
  canDelete: boolean;
  updatedAt: Date | string;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [emoji, setEmoji] = useState(initialEmoji ?? "");
  const [savedAt, setSavedAt] = useState<Date | null>(new Date(updatedAt));
  const [saving, setSaving] = useState(false);
  const [pending, start] = useTransition();
  const lastDoc = useRef<Block[] | null>(initialContent);
  const { toast } = useToast();

  // Debounced autosave for content
  useEffect(() => {
    const id = setInterval(async () => {
      if (!lastDoc.current) return;
      setSaving(true);
      try {
        await savePageContent(pageId, lastDoc.current);
        setSavedAt(new Date());
      } finally {
        setSaving(false);
      }
    }, 5000);
    return () => clearInterval(id);
  }, [pageId]);

  function persistMeta() {
    const fd = new FormData();
    fd.set("title", title);
    fd.set("emoji", emoji);
    start(async () => {
      try {
        await updatePage(pageId, fd);
        setSavedAt(new Date());
      } catch (e) {
        toast(e instanceof Error ? e.message : "Could not save page metadata", "error");
      }
    });
  }

  function onDelete() {
    if (!confirm("Archive this page? You can find archived pages in the database backup; the UI doesn't restore them yet.")) return;
    start(async () => {
      try {
        await archivePage(pageId);
        toast("Page archived", "info");
      } catch (e) {
        toast(e instanceof Error ? e.message : "Could not archive page", "error");
      }
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-start gap-3">
        <input
          value={emoji}
          onChange={(e) => setEmoji(e.target.value.slice(0, 4))}
          onBlur={persistMeta}
          placeholder="📄"
          className="h-12 w-14 rounded border border-transparent bg-transparent text-center text-3xl hover:border-slate-200 focus:border-slate-300 focus:outline-none"
        />
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={persistMeta}
          placeholder="Untitled"
          className="h-12 border-none bg-transparent px-2 text-3xl font-semibold focus-visible:ring-0"
        />
        {canDelete && (
          <Button type="button" variant="ghost" size="sm" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="px-2 text-xs text-slate-400">
        {saving || pending ? "Saving…" : savedAt ? `Saved ${savedAt.toLocaleTimeString()}` : "Unsaved"}
      </div>

      <BlockEditor
        initialContent={initialContent}
        onChange={(doc) => {
          lastDoc.current = doc;
        }}
      />
    </div>
  );
}
