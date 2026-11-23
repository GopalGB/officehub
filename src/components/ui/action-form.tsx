"use client";
import { settle } from "@/lib/action-result";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { preserveCurrentAllocations } from "@/lib/allocation-form";
import { friendlyError, isNavigationSignal } from "@/lib/utils";
export function ActionForm({
  action,
  children,
  label = "Save changes",
  className = "space-y-4",
  successMessage,
}: {
  action: (fd: FormData) => Promise<unknown>;
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
            await settle(action)(preserveCurrentAllocations(fd));
            setSaved(true);
            if (successMessage) toast(successMessage, "success");
          } catch (cause) {
            // A redirect after saving is success, not an error toast.
            if (isNavigationSignal(cause)) throw cause;
            const message = friendlyError(cause);
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
