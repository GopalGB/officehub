"use client";
import Link from "next/link";
import { useEffect } from "react";

/** Last resort for unexpected server errors: keep the shell and offer a way back. */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    document.title = "Something went wrong · OfficeHub";
  }, []);
  return (
    <div className="mx-auto max-w-lg space-y-4 py-16 text-center">
      <h1 className="page-title">Something went wrong</h1>
      <p className="text-sm text-muted-foreground">
        The last action could not be completed. Nothing else was changed. Try again, or go back and reload the page.
      </p>
      {error.digest && <p className="text-xs text-muted-foreground">Reference: {error.digest}</p>}
      <div className="flex justify-center gap-3">
        <button type="button" onClick={reset} className="rounded-md bg-brand-navy px-4 py-2 text-sm font-medium text-white">
          Try again
        </button>
        <Link href="/dashboard" className="rounded-md border px-4 py-2 text-sm">
          My workspace
        </Link>
      </div>
    </div>
  );
}
