"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { preserveCurrentAllocations } from "@/lib/allocation-form";
export function ActionForm({
  action,
  children,
  label = "Save changes",
  className = "space-y-4",
  successMessage,
}: {
  action: (fd: FormData) => Promise<void>;
  children?: React.ReactNode;
  label?: string;
  className?: string;
  successMessage?: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const { toast } = useToast();
  return (
    <form
      className={className}
      action={(fd) =>
        start(async () => {
          setError("");
          setSaved(false);
          try {
            await action(preserveCurrentAllocations(fd));
            setSaved(true);
            if (successMessage) toast(successMessage, "success");
          } catch (cause) {
            const message =
              cause instanceof Error
                ? cause.message
                : "Could not save. Please try again.";
            setError(message);
            toast(message, "error");
          }
        })
      }
    >
      {children}
      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
      {saved && successMessage && (
        <p
          role="status"
          className="text-sm text-emerald-700 dark:text-emerald-300"
        >
          {successMessage}
        </p>
      )}
      <Button type="submit" disabled={pending} size="sm">
        {pending ? "Saving…" : label}
      </Button>
    </form>
  );
}
