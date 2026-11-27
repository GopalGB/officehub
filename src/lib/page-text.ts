/** Plain text from a BlockNote document, for wiki search. */
export function blockText(value: unknown, out: string[] = [], depth = 0): string[] {
  if (depth > 30 || out.length > 5000) return out;
  if (Array.isArray(value)) {
    for (const item of value) blockText(item, out, depth + 1);
  } else if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.text === "string") out.push(record.text);
    for (const key of ["content", "children", "rows", "cells"]) blockText(record[key], out, depth + 1);
  }
  return out;
}

export function searchSnippet(text: string, query: string, radius = 80) {
  const at = text.toLowerCase().indexOf(query.toLowerCase());
  if (at < 0) return text.slice(0, radius * 2);
  const start = Math.max(0, at - radius);
  return `${start ? "…" : ""}${text.slice(start, at + query.length + radius)}${at + query.length + radius < text.length ? "…" : ""}`;
}
