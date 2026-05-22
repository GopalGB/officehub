"use client";

import { useState } from "react";
import type { Block } from "@blocknote/core";
import { BlockEditor } from "./BlockEditor";

interface Props {
  name: string;
  initial?: Block[] | null;
  placeholder?: string;
}

export function BlockField({ name, initial }: Props) {
  const [doc, setDoc] = useState<Block[] | null>(initial ?? null);
  return (
    <>
      <input type="hidden" name={name} value={JSON.stringify(doc ?? [])} />
      <BlockEditor initialContent={initial} onChange={setDoc} />
    </>
  );
}
