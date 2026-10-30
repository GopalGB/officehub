"use client";
import { useState, useRef } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AdditionalDetail } from "@/lib/additional-details";

export function AdditionalDetailsEditor({
  initial = [],
}: {
  initial?: AdditionalDetail[];
}) {
  const nextId = useRef(initial.length);
  const [fields, setFields] = useState(() =>
    initial.map((field, index) => ({ ...field, id: String(index) })),
  );
  const change = (id: string, key: "label" | "value", value: string) =>
    setFields((current) =>
      current.map((field) =>
        field.id === id ? { ...field, [key]: value } : field,
      ),
    );
  return (
    <section className="space-y-4 rounded-xl border bg-secondary/20 p-4">
      <div>
        <h2 className="text-sm font-semibold">Additional details</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Keep extra spreadsheet columns or project-specific information here.
          Each field has its own name and value.
        </p>
      </div>
      <input
        type="hidden"
        name="additionalDetails"
        value={JSON.stringify(
          fields.map(({ label, value }) => ({ label, value })),
        )}
      />
      {fields.map((field, index) => (
        <div
          key={field.id}
          className="grid gap-3 rounded-lg border bg-card p-3 sm:grid-cols-[1fr_2fr_auto]"
        >
          <label className="field">
            Field name
            <input
              aria-label={`Additional field ${index + 1} name`}
              value={field.label}
              onChange={(event) =>
                change(field.id, "label", event.target.value)
              }
              required
              maxLength={100}
              placeholder="e.g. Source system"
            />
          </label>
          <label className="field">
            Value
            <textarea
              aria-label={`Additional field ${index + 1} value`}
              value={field.value}
              onChange={(event) =>
                change(field.id, "value", event.target.value)
              }
              maxLength={5000}
              rows={2}
              placeholder="Text, a reference, a date, or a file location"
            />
          </label>
          <button
            type="button"
            aria-label={`Remove additional field ${index + 1}`}
            className="self-start rounded-lg p-2 hover:bg-secondary sm:mt-6"
            onClick={() =>
              setFields((current) =>
                current.filter((item) => item.id !== field.id),
              )
            }
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
      {!fields.length && (
        <p className="text-xs text-muted-foreground">
          No additional fields yet.
        </p>
      )}
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={fields.length >= 50}
        onClick={() => {
          const id = String(nextId.current++);
          setFields((current) => [...current, { id, label: "", value: "" }]);
        }}
      >
        <Plus className="h-4 w-4" /> Add field
      </Button>
    </section>
  );
}
