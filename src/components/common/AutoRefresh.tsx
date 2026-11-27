"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/** Re-fetch server data on an interval while the tab is visible. */
export function AutoRefresh({ seconds = 30 }: { seconds?: number }) {
  const router = useRouter();
  const [stamp, setStamp] = useState<string>("");
  useEffect(() => {
    setStamp(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      router.refresh();
      setStamp(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    }, seconds * 1000);
    return () => window.clearInterval(timer);
  }, [router, seconds]);
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" role="status">
      <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" aria-hidden="true" />
      Live · refreshes every {seconds}s{stamp ? ` · updated ${stamp}` : ""}
    </span>
  );
}
