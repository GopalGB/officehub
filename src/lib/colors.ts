// Monochrome palette — white, black, and grays only.
// Avatar styling derives from a deterministic hash, but the palette itself
// is intentionally constrained so the UI stays high-contrast and on-brand.

function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// All avatars use the same neutral palette. The hash still picks a slot
// so different people aren't visually identical (slight tonal variation).
const PALETTE = [
  { bg: "bg-black", fg: "text-white", ring: "ring-black/20" },
  { bg: "bg-neutral-800", fg: "text-white", ring: "ring-neutral-700/30" },
  { bg: "bg-neutral-700", fg: "text-white", ring: "ring-neutral-600/30" },
  { bg: "bg-neutral-200", fg: "text-black", ring: "ring-neutral-300" },
  { bg: "bg-neutral-100", fg: "text-black", ring: "ring-neutral-200" },
  { bg: "bg-white", fg: "text-black", ring: "ring-neutral-300" },
];

export function colorFor(seed: string) {
  return PALETTE[hash(seed) % PALETTE.length];
}

// Used by tag swatches when no preset is set — kept gray.
export function hueFromSeed(_seed: string): string {
  return `hsl(0 0% 92%)`;
}
