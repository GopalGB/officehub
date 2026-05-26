// Pure-white palette — avatars use only light surfaces with black text.
function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

const PALETTE = [
  { bg: "bg-white", fg: "text-black", ring: "ring-black/15" },
  { bg: "bg-neutral-50", fg: "text-black", ring: "ring-black/15" },
  { bg: "bg-neutral-100", fg: "text-black", ring: "ring-black/20" },
  { bg: "bg-neutral-200", fg: "text-black", ring: "ring-black/20" },
];

export function colorFor(seed: string) {
  return PALETTE[hash(seed) % PALETTE.length];
}

export function hueFromSeed(_seed: string): string {
  return `hsl(0 0% 96%)`;
}
