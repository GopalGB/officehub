/** Built-in text similarity (TF-IDF with cosine similarity). It compares the
 * words in two pieces of text, weighting rare words more than common ones.
 * It runs inside OfficeHub: no model download, no data leaves the server. */

const STOP = new Set(
  "a an and are as at be by for from has have in into is it its of on or our please that the their this to was we were will with you your new need needs want help can could should would via per each all any also make get".split(
    " ",
  ),
);

/** Lowercase words with light English stemming, so "reports"/"reporting" match "report". */
export function tokens(text: string): string[] {
  const words = text
    .normalize("NFKC")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 1 && !STOP.has(w));
  return words.map(stem).filter((w) => w.length > 1 && !STOP.has(w));
}

function stem(word: string) {
  if (/^\d+$/.test(word) || word.length <= 4) return word;
  for (const suffix of ["ations", "ation", "ings", "ing", "ies", "ers", "er", "ed", "es", "s", "ly"]) {
    if (word.endsWith(suffix) && word.length - suffix.length >= 3) {
      const base = word.slice(0, -suffix.length);
      return suffix === "ies" ? base + "y" : base;
    }
  }
  return word;
}

/** Words plus adjacent word pairs, so "sales dashboard" beats two unrelated mentions. */
function features(text: string) {
  const t = tokens(text);
  const out = [...t];
  for (let i = 0; i + 1 < t.length; i++) out.push(`${t[i]}_${t[i + 1]}`);
  return out;
}

export type Doc<T> = { text: string; item: T };
export type Match<T> = { item: T; score: number };

/** Index a small corpus once, then rank it against any query text. */
export function similarityIndex<T>(docs: Doc<T>[]) {
  const df = new Map<string, number>();
  const bags = docs.map((d) => {
    const bag = new Map<string, number>();
    for (const f of features(d.text)) bag.set(f, (bag.get(f) ?? 0) + 1);
    for (const f of bag.keys()) df.set(f, (df.get(f) ?? 0) + 1);
    return bag;
  });
  const n = docs.length;
  const idf = (f: string) => Math.log((n + 1) / ((df.get(f) ?? 0) + 1)) + 1;
  const vector = (bag: Map<string, number>) => {
    const v = new Map<string, number>();
    let norm = 0;
    for (const [f, count] of bag) {
      const w = (1 + Math.log(count)) * idf(f);
      v.set(f, w);
      norm += w * w;
    }
    return { v, norm: Math.sqrt(norm) || 1 };
  };
  const vectors = bags.map(vector);
  return {
    size: n,
    rank(query: string, limit = 10, minScore = 0.1): Match<T>[] {
      const bag = new Map<string, number>();
      for (const f of features(query)) bag.set(f, (bag.get(f) ?? 0) + 1);
      if (!bag.size) return [];
      const q = vector(bag);
      const scored: Match<T>[] = [];
      vectors.forEach((d, i) => {
        let dot = 0;
        for (const [f, w] of q.v) {
          const other = d.v.get(f);
          if (other) dot += w * other;
        }
        const score = dot / (q.norm * d.norm);
        if (score >= minScore) scored.push({ item: docs[i].item, score });
      });
      return scored.sort((a, b) => b.score - a.score).slice(0, limit);
    },
  };
}

/** Similarity-weighted average of neighbours' values (k nearest). */
export function weightedEstimate(matches: Match<{ value: number }>[]) {
  const usable = matches.filter((m) => Number.isFinite(m.item.value) && m.item.value > 0);
  if (!usable.length) return null;
  const total = usable.reduce((s, m) => s + m.score, 0);
  const value = usable.reduce((s, m) => s + m.item.value * m.score, 0) / total;
  return Math.round(value * 4) / 4;
}

/** The value most supported by similar items, if any clearly wins. */
export function weightedVote<V extends string>(matches: Match<{ value: V | null }>[]) {
  const votes = new Map<V, number>();
  for (const m of matches) if (m.item.value) votes.set(m.item.value, (votes.get(m.item.value) ?? 0) + m.score);
  const ranked = [...votes.entries()].sort((a, b) => b[1] - a[1]);
  if (!ranked.length) return null;
  const total = ranked.reduce((s, [, w]) => s + w, 0);
  const [value, weight] = ranked[0];
  return weight / total >= 0.5 ? { value, confidence: weight / total } : null;
}
