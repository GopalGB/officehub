"use client";

import { Star } from "lucide-react";
import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { toggleProjectFavorite } from "@/app/dashboard/actions";
import { useToast } from "@/components/ui/toast";

export function FavoriteButton({
  projectId,
  initiallyFavorited,
  size = "md",
  className,
}: {
  projectId: string;
  initiallyFavorited: boolean;
  size?: "sm" | "md";
  className?: string;
}) {
  const [fav, setFav] = useState(initiallyFavorited);
  const [pending, start] = useTransition();
  const { toast } = useToast();

  function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const next = !fav;
    setFav(next); // optimistic
    start(async () => {
      try {
        await toggleProjectFavorite(projectId);
        toast(next ? "Pinned to your favorites" : "Unpinned", "success");
      } catch {
        setFav(!next); // revert
        toast("Could not update favorite", "error");
      }
    });
  }

  const px = size === "sm" ? "h-7 w-7" : "h-8 w-8";
  const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-pressed={fav}
      aria-label={fav ? "Unpin from favorites" : "Pin to favorites"}
      title={fav ? "Unpin" : "Pin to favorites"}
      className={cn(
        "inline-flex items-center justify-center rounded-md transition-colors hover:bg-slate-100 dark:hover:bg-slate-800",
        px,
        className,
      )}
    >
      <Star
        className={cn(
          iconSize,
          fav ? "fill-amber-400 text-amber-400" : "text-slate-400 dark:text-slate-500",
        )}
      />
    </button>
  );
}
