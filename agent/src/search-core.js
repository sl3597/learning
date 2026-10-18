// BM25 search shared by the Node indexer (kb.js) and the static site (loaded in the browser as an ES module),
// so GitHub Pages search ranks exactly like the local server. Pure JS: no Node or DOM APIs here.

/** Lowercase ASCII words + CJK character bigrams (and unigrams for single chars). */
export function tokenize(text) {
  const tokens = [];
  const lower = text.toLowerCase();
  for (const word of lower.match(/[a-z0-9_][a-z0-9_.+\-]*/g) ?? []) tokens.push(word);
  const cjkRuns = lower.match(/[㐀-鿿豈-﫿]+/g) ?? [];
  for (const run of cjkRuns) {
    if (run.length === 1) tokens.push(run);
    for (let i = 0; i < run.length - 1; i++) tokens.push(run.slice(i, i + 2));
  }
  return tokens;
}

export function makeSnippet(text, qTokens, width = 220) {
  const lower = text.toLowerCase();
  let best = 0;
  for (const t of qTokens) {
    const i = lower.indexOf(t);
    if (i >= 0) {
      best = Math.max(0, i - width / 3);
      break;
    }
  }
  const s = text.slice(best, best + width).replace(/\s+/g, " ");
  return (best > 0 ? "…" : "") + s + (best + width < text.length ? "…" : "");
}

/** chunks: [{relPath, title, heading, text, topic, type}] — one per H2 section. */
export class SearchIndex {
  constructor(chunks) {
    this.chunks = [];
    this.df = new Map();
    for (const c of chunks) {
      const tokens = tokenize(`${c.title}\n${c.heading}\n${c.text}`);
      const tf = new Map();
      for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
      for (const t of tf.keys()) this.df.set(t, (this.df.get(t) ?? 0) + 1);
      this.chunks.push({ ...c, tf, len: tokens.length });
    }
    this.avgLen = this.chunks.reduce((a, c) => a + c.len, 0) / Math.max(1, this.chunks.length);
  }

  /** Returns [{relPath, title, heading, score, snippet}]; filter may restrict {topic, type}. */
  search(query, k = 8, filter = {}) {
    const qTokens = [...new Set(tokenize(query))];
    if (!qTokens.length) return [];
    const N = this.chunks.length;
    const k1 = 1.5;
    const b = 0.75;
    const scored = [];
    for (const c of this.chunks) {
      if (filter.topic && c.topic !== filter.topic) continue;
      if (filter.type && c.type !== filter.type) continue;
      let score = 0;
      for (const t of qTokens) {
        const tf = c.tf.get(t);
        if (!tf) continue;
        const df = this.df.get(t) ?? 0;
        const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
        score += idf * ((tf * (k1 + 1)) / (tf + k1 * (1 - b + (b * c.len) / this.avgLen)));
      }
      if (score > 0) scored.push({ c, score });
    }
    scored.sort((a, b2) => b2.score - a.score);
    return scored.slice(0, k).map(({ c, score }) => ({
      relPath: c.relPath,
      title: c.title,
      heading: c.heading,
      score: Number(score.toFixed(3)),
      snippet: makeSnippet(c.text, qTokens),
    }));
  }
}
