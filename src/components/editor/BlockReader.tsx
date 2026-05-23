"use client";

import { useEffect, useState } from "react";
import type { Block } from "@blocknote/core";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";

function ReaderInner({ content }: { content: Block[] | null | undefined }) {
  const editor = useCreateBlockNote({
    initialContent: content && content.length ? content : undefined,
  });
  return (
    <div className="prose prose-sm max-w-none">
      <BlockNoteView editor={editor} editable={false} theme="light" />
    </div>
  );
}

export function BlockReader({ content }: { content: Block[] | null | undefined }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) {
    return <div className="text-sm text-slate-400">Loading…</div>;
  }
  return <ReaderInner content={content} />;
}
