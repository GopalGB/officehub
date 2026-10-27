// Soft Catalyst palette keeps names legible without implying a role.
function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

const PALETTE = [
  { bg: "bg-blue-50", fg: "text-brand-navy", ring: "ring-brand-blue/20" },
  { bg: "bg-brand-tint", fg: "text-brand-navy", ring: "ring-brand-orange/25" },
  { bg: "bg-secondary", fg: "text-brand-navy", ring: "ring-brand-navy/15" },
  { bg: "bg-slate-100", fg: "text-brand-navy", ring: "ring-brand-navy/20" },
];

export function colorFor(seed: string) {
  return PALETTE[hash(seed) % PALETTE.length];
}

export function hueFromSeed(_seed: string): string {
  return `hsl(0 0% 96%)`;
}
