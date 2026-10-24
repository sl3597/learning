// BM25 search shared by the Node indexer (kb.js) and the static site (loaded in the browser as an ES module),
// so GitHub Pages search ranks exactly like the local server. Pure JS: no Node or DOM APIs here.

// UTF-16 code-unit ranges that count as "CJK" (no `u` flag, on purpose: the index on GitHub Pages must tokenize
// byte-for-byte like the server). compactText() keeps every unit this class matches so the token stream is unchanged.
const CJK_CLASS = "㐀-鿿豈-﫿";
const CJK_RUNS = new RegExp(`[${CJK_CLASS}]+`, "g");
const CJK_UNIT = new RegExp(`[${CJK_CLASS}]`);

/** Lowercase ASCII words + CJK character bigrams (and unigrams for single chars). */
export function tokenize(text) {
  const tokens = [];
  const lower = text.toLowerCase();
  for (const word of lower.match(/[a-z0-9_][a-z0-9_.+\-]*/g) ?? []) tokens.push(word);
  const cjkRuns = lower.match(CJK_RUNS) ?? [];
  for (const run of cjkRuns) {
    if (run.length === 1) tokens.push(run);
    for (let i = 0; i < run.length - 1; i++) tokens.push(run.slice(i, i + 2));
  }
  return tokens;
}

/** Heading kb.js gives the text before the first H2 (the chapter's one-line intro + overview). */
export const INTRO_HEADING = "（开头）";

/** Words of a file name: "Knowledge/VLA/Pi/02-pi0-architecture-and-flow-matching.md" → "pi0 architecture and flow matching". */
export function fileWords(relPath) {
  const base = String(relPath ?? "").split("/").pop() ?? "";
  return base.replace(/\.md$/i, "").replace(/^\d{2}-/, "").replace(/-/g, " ");
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

// ---- compact index for the static site (dist/data/search.json) ----
// Pre-tokenizing does not help here: CJK bigrams repeat every character twice, so a {term: tf} map is
// bigger than the text it came from. What does shrink losslessly is folding punctuation, symbols, markdown
// syntax and whitespace (including full-width punctuation) into single spaces, and storing
// title / path / topic / type once per document instead of once per section.

/** Letters and numbers of every script (π, é, ０…) plus the ASCII chars that can continue a token. */
const KEEP = /[\p{L}\p{N}_.+\-]/u;
/** Combining marks (é as e + U+0301, emoji variation selectors) ride along with the character before them. */
const MARK = /\p{M}/u;

/**
 * Same tokens as `text`, fewer bytes: runs of punctuation / symbols / whitespace collapse to one space; letters and
 * numbers of every script are kept verbatim so snippets still read "π0：VLM 骨干" as "π0 VLM 骨干". Anything the
 * tokenizer's CJK class matches is kept too (that includes astral characters such as emoji, which it tokenizes),
 * and everything else is a separator to tokenize() either way — so the token sequence cannot change.
 */
export function compactText(text) {
  let out = "";
  let gap = false;
  for (const ch of String(text ?? "")) {
    if (KEEP.test(ch) || CJK_UNIT.test(ch)) {
      if (gap && out) out += " ";
      gap = false;
      out += ch;
    } else if (MARK.test(ch)) {
      if (!gap && out) out += ch; // a mark whose base character was dropped (⚠️ → U+26A0 + U+FE0F) goes with it
    } else gap = true;
  }
  return out;
}

/** [{relPath, title, heading, text, topic, type}] → {v: 2, docs: [{relPath, title, topic, type, sections: [{heading, text}]}]} */
export function packChunks(chunks) {
  const docs = [];
  let cur = null;
  for (const c of chunks) {
    if (!cur || cur.relPath !== c.relPath) {
      cur = { relPath: c.relPath, title: c.title, topic: c.topic ?? null, type: c.type ?? null, sections: [] };
      docs.push(cur);
    }
    cur.sections.push({ heading: c.heading, text: compactText(c.text) });
  }
  return { v: 2, docs };
}

/** Inverse of packChunks (section order and document order are preserved, so scores match the server). */
export function unpackChunks(packed) {
  const chunks = [];
  for (const d of packed?.docs ?? []) {
    for (const s of d.sections) chunks.push({ relPath: d.relPath, title: d.title, heading: s.heading, text: s.text, topic: d.topic, type: d.type });
  }
  return chunks;
}

// ---- ranking ----

const K1 = 1.5;
const B = 0.75;
/** Weight of the title/file-name BM25 component (the body component is 1). */
export const TITLE_WEIGHT = 2.5;
/** Extra share of the title component given to a document's intro section, so a title hit lands on the chapter's opening. */
export const INTRO_TITLE_BOOST = 1;
/** Small multiplier on the body score of intro sections (breaks ties with 学习目标 / 小结 / 参考资料 of the same document). */
export const INTRO_BODY_BOOST = 1.05;

const idfOf = (N, df) => Math.log(1 + (N - df + 0.5) / (df + 0.5));

/**
 * chunks: [{relPath, title, heading, text, topic, type}] — one per H2 section — or the packed form
 * written by packChunks(). Two BM25 fields: the section body (heading + text, length-normalized) and the
 * document's title + file-name words (one per document, no length normalization).
 */
export class SearchIndex {
  constructor(input) {
    const chunks = Array.isArray(input) ? input : unpackChunks(input);
    this.chunks = [];
    this.df = new Map(); // body term → sections containing it
    this.titleDf = new Map(); // title term → documents whose title / file name contains it
    const titleTfByDoc = new Map();
    for (const c of chunks) {
      const tokens = tokenize(`${c.heading}\n${c.text}`);
      const tf = new Map();
      for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
      for (const t of tf.keys()) this.df.set(t, (this.df.get(t) ?? 0) + 1);
      let ttf = titleTfByDoc.get(c.relPath);
      if (!ttf) {
        ttf = new Map();
        for (const t of tokenize(`${c.title}\n${fileWords(c.relPath)}`)) ttf.set(t, (ttf.get(t) ?? 0) + 1);
        for (const t of ttf.keys()) this.titleDf.set(t, (this.titleDf.get(t) ?? 0) + 1);
        titleTfByDoc.set(c.relPath, ttf);
      }
      this.chunks.push({ ...c, tf, ttf, len: tokens.length });
    }
    this.docCount = titleTfByDoc.size;
    this.avgLen = this.chunks.reduce((a, c) => a + c.len, 0) / Math.max(1, this.chunks.length);
  }

  /** Returns [{relPath, title, heading, score, snippet}]; filter may restrict {topic, type}. */
  search(query, k = 8, filter = {}) {
    const qTokens = [...new Set(tokenize(query))];
    if (!qTokens.length) return [];
    const N = this.chunks.length;
    const D = this.docCount;
    const scored = [];
    for (const c of this.chunks) {
      if (filter.topic && c.topic !== filter.topic) continue;
      if (filter.type && c.type !== filter.type) continue;
      let body = 0;
      let title = 0;
      let titleHits = 0;
      for (const t of qTokens) {
        const tf = c.tf.get(t);
        if (tf) body += idfOf(N, this.df.get(t) ?? 0) * ((tf * (K1 + 1)) / (tf + K1 * (1 - B + (B * c.len) / this.avgLen)));
        const ttf = c.ttf.get(t);
        if (ttf) {
          title += idfOf(D, this.titleDf.get(t) ?? 0) * ((ttf * (K1 + 1)) / (ttf + K1));
          titleHits++;
        }
      }
      // Sections that never mention the query get nothing from the document's title — except the intro, which is
      // where a document-level hit should land. A title hit is only strong evidence when it covers most of the
      // query ("flow matching" vs. two of nine bigrams of a long sentence happening to appear in some title).
      const intro = c.heading === INTRO_HEADING;
      if (body <= 0 && !(intro && title > 0)) continue;
      const titleScore = title * (titleHits / qTokens.length) * (TITLE_WEIGHT + (intro ? INTRO_TITLE_BOOST : 0));
      const score = body * (intro ? INTRO_BODY_BOOST : 1) + titleScore;
      scored.push({ c, score });
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
