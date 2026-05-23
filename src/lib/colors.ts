// Deterministic color from a string (e.g. user name).
// Returns matched bg/fg pairs so contrast stays accessible.

function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

const PALETTE = [
  { bg: "bg-rose-100", fg: "text-rose-900", ring: "ring-rose-300" },
  { bg: "bg-orange-100", fg: "text-orange-900", ring: "ring-orange-300" },
  { bg: "bg-amber-100", fg: "text-amber-900", ring: "ring-amber-300" },
  { bg: "bg-lime-100", fg: "text-lime-900", ring: "ring-lime-300" },
  { bg: "bg-emerald-100", fg: "text-emerald-900", ring: "ring-emerald-300" },
  { bg: "bg-teal-100", fg: "text-teal-900", ring: "ring-teal-300" },
  { bg: "bg-sky-100", fg: "text-sky-900", ring: "ring-sky-300" },
  { bg: "bg-indigo-100", fg: "text-indigo-900", ring: "ring-indigo-300" },
  { bg: "bg-violet-100", fg: "text-violet-900", ring: "ring-violet-300" },
  { bg: "bg-fuchsia-100", fg: "text-fuchsia-900", ring: "ring-fuchsia-300" },
];

export function colorFor(seed: string) {
  return PALETTE[hash(seed) % PALETTE.length];
}

// Hex hue rotation for tag swatches when no preset color is set.
export function hueFromSeed(seed: string): string {
  return `hsl(${hash(seed) % 360} 60% 90%)`;
}
