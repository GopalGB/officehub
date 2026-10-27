"use client";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
export function CopyLink({ url }: { url: string }) {
  const input = useRef<HTMLInputElement>(null),
    [message, setMessage] = useState("");
  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <input
          ref={input}
          aria-label="Shareable request link"
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 rounded-md border bg-secondary px-3 py-2 text-xs"
        />
        <Button
          size="sm"
          variant="outline"
          type="button"
          onClick={() => {
            void (async () => {
              try {
                if (navigator.clipboard && window.isSecureContext)
                  await navigator.clipboard.writeText(url);
                else {
                  input.current?.select();
                  if (!document.execCommand("copy"))
                    throw new Error("Select link");
                }
                setMessage("Link copied");
              } catch {
                input.current?.select();
                setMessage("Press Ctrl+C to copy the selected link");
              }
            })();
          }}
        >
          Copy link
        </Button>
      </div>
      {message && (
        <p role="status" className="text-xs text-muted-foreground">
          {message}
        </p>
      )}
    </div>
  );
}
