"use client";

import { useEffect, useState } from "react";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import type { Block } from "@blocknote/core";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";

type BlockDoc = Block[];

interface Props {
  initialContent?: BlockDoc | null;
  onChange?: (doc: BlockDoc) => void;
  editable?: boolean;
  placeholder?: string;
  className?: string;
}

function EditorInner({ initialContent, onChange, editable = true }: Props) {
  const editor = useCreateBlockNote({
    initialContent: initialContent && initialContent.length ? (initialContent as Block[]) : undefined,
  });

  return (
    <BlockNoteView
      editor={editor}
      editable={editable}
      theme="light"
      onChange={() => onChange?.(editor.document as BlockDoc)}
    />
  );
}

export function BlockEditor(props: Props) {
  // BlockNote touches `window` — guard SSR.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className="min-h-[200px] rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-400">
        Loading editor…
      </div>
    );
  }

  return (
    <div className={`rounded-md border border-slate-200 bg-white p-2 ${props.className ?? ""}`}>
      <EditorInner {...props} />
    </div>
  );
}
