/* Learning 知识库前端：文档站风格阅读器 + 搜索面板 + 助教抽屉 + 论文导入 */
(() => {
  const $ = (s) => document.querySelector(s);
  const layout = $("#layout");
  const treeEl = $("#tree");
  const contentEl = $("#content");
  const tocEl = $("#toc");
  const mainEl = $("#main");
  const chatLog = $("#chatLog");
  let tree = null;
  let flatFiles = [];
  let currentPath = "";
  let history = [];
  const isMobile = () => window.matchMedia("(max-width: 900px)").matches;

  // ---------- 数据来源：本机服务（/api，含助教）或静态站（data/*.json，GitHub Pages，只读）----------
  const STATIC = window.KB_STATIC === true;
  const LOCAL_URL = "http://localhost:8787/";
  const getJSON = async (u) => { const r = await fetch(u); if (!r.ok) throw new Error(`${r.status} ${u}`); return r.json(); };
  let searchIndex = null;
  const data = {
    tree: () => getJSON(STATIC ? "data/tree.json" : "/api/tree"),
    stats: () => getJSON(STATIC ? "data/stats.json" : "/api/stats"),
    doc: async (p) => { const r = await fetch(STATIC ? `data/doc/${p}.json` : `/api/doc?path=${encodeURIComponent(p)}`); return r.ok ? r.json() : null; },
    search: async (q, k) => {
      if (!STATIC) return getJSON(`/api/search?q=${encodeURIComponent(q)}&k=${k}`);
      // 静态站在浏览器里跑同一套 BM25（search-core.js），第一次搜索时加载
      if (!searchIndex) { const [{ SearchIndex }, chunks] = await Promise.all([import("./search-core.js"), getJSON("data/search.json")]); searchIndex = new SearchIndex(chunks); }
      return searchIndex.search(q, k);
    },
  };
  const hasMarked = typeof window.marked !== "undefined";
  const hasHljs = typeof window.hljs !== "undefined";

  // ---------- 主题 ----------
  const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
  function applyTheme(t) {
    document.documentElement.dataset.theme = t;
    $("#hljsLight").disabled = t === "dark";
    $("#hljsDark").disabled = t !== "dark";
    $("#themeBtn").textContent = t === "dark" ? "☀️" : "🌙";
    if (window.mermaid) { try { mermaid.initialize({ startOnLoad: false, theme: t === "dark" ? "dark" : "neutral", securityLevel: "loose" }); } catch {} }
  }
  const initialTheme = store.get("theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  applyTheme(initialTheme);
  $("#themeBtn").addEventListener("click", () => { const t = document.documentElement.dataset.theme === "dark" ? "light" : "dark"; store.set("theme", t); applyTheme(t); if (currentPath) route(); });

  // ---------- Markdown 渲染 ----------
  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function resolveRel(from, href) {
    const base = from.includes("/") ? from.slice(0, from.lastIndexOf("/")).split("/") : [];
    for (const part of href.split("/")) { if (part === "..") base.pop(); else if (part !== "." && part !== "") base.push(part); }
    return base.join("/");
  }
  const slug = (s) => s.toLowerCase().replace(/<[^>]+>/g, "").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "") || "s";
  let headingIds = {};

  if (hasMarked) {
    marked.setOptions({ gfm: true, breaks: false });
    const renderer = new marked.Renderer();
    // marked 12 的 renderer 使用位置参数：heading(text, level) / code(code, lang) / table(header, body) / link(href, title, text)
    renderer.heading = (text, level) => {
      let id = slug(text); if (headingIds[id]) id += "-" + ++headingIds[id]; else headingIds[id] = 1;
      return `<h${level} id="${id}">${text}</h${level}>`;
    };
    renderer.code = (code, infostring) => {
      const lang = (infostring || "").trim().split(/\s+/)[0];
      if (lang === "mermaid") return `<div class="mermaid-wrap"><pre class="mermaid">${escapeHtml(code)}</pre></div>`;
      const valid = hasHljs && lang && hljs.getLanguage(lang);
      const html = valid ? hljs.highlight(code, { language: lang }).value : escapeHtml(code);
      return `<div class="codeblock"><div class="code-head"><span>${escapeHtml(lang || "text")}</span><button class="copy" type="button">复制</button></div><pre><code class="hljs language-${escapeHtml(lang || "text")}">${html}</code></pre></div>`;
    };
    renderer.table = (header, body) => `<div class="table-wrap"><table><thead>${header}</thead><tbody>${body}</tbody></table></div>`;
    renderer.link = (href, title, text) => {
      const t = title ? ` title="${escapeHtml(title)}"` : "";
      if (/^https?:/.test(href)) return `<a href="${href}"${t} target="_blank" rel="noopener">${text} ↗</a>`;
      const [p, hash] = href.split("#");
      if (p.endsWith(".md")) return `<a href="#/${resolveRel(currentPath, p)}${hash ? "#" + hash : ""}"${t}>${text}</a>`;
      return `<a href="${href}"${t}>${text}</a>`;
    };
    renderer.image = (href, title, text) => {
      const src = /^https?:/.test(href) ? href : `kb/${resolveRel(currentPath, href)}`;
      return `<img src="${src}" alt="${escapeHtml(text || "")}"${title ? ` title="${escapeHtml(title)}"` : ""} loading="lazy">`;
    };
    marked.use({ renderer });
  } else {
    const warn = document.createElement("div");
    warn.style.cssText = "background:#fff4e5;color:#7a4b00;padding:6px 16px;font-size:13px";
    warn.textContent = "⚠️ Markdown 渲染库未加载，已退化为纯文本显示。请在 agent/ 目录执行 npm install 后刷新。";
    document.body.insertBefore(warn, layout);
  }

  function renderMarkdown(md, basePath) {
    if (!hasMarked) return `<pre style="white-space:pre-wrap">${escapeHtml(md)}</pre>`;
    const prev = currentPath; currentPath = basePath ?? currentPath; headingIds = {};
    let html; try { html = marked.parse(md); } catch { html = `<pre style="white-space:pre-wrap">${escapeHtml(md)}</pre>`; }
    currentPath = prev; return html;
  }

  const CALLOUTS = [["💡", "tip", "要点"], ["⚠️", "warn", "注意"], ["❓", "warn", "待解决"], ["🔍", "deep", "深入"], ["🔗", "info", "关联"], ["📌", "info", "提示"]];
  function postProcess(root) {
    root.querySelectorAll("blockquote").forEach((bq) => {
      const p = bq.querySelector("p"); if (!p) return;
      const text = p.textContent.trim();
      for (const [emoji, cls, label] of CALLOUTS) {
        if (text.startsWith(emoji)) {
          bq.classList.add("callout", cls);
          p.innerHTML = p.innerHTML.replace(emoji, "").replace(/^\s*(要点|注意|待解决|深入|关联|提示)\s*[：:]\s*/, "");
          const t = document.createElement("span"); t.className = "callout-title"; t.textContent = `${emoji} ${label}`; bq.insertBefore(t, p);
          break;
        }
      }
    });
    root.querySelectorAll(".codeblock .copy").forEach((btn) => btn.addEventListener("click", async () => {
      const code = btn.closest(".codeblock").querySelector("code").innerText;
      try { await navigator.clipboard.writeText(code); btn.textContent = "已复制 ✓"; } catch { btn.textContent = "复制失败"; }
      setTimeout(() => (btn.textContent = "复制"), 1500);
    }));
    if (window.renderMathInElement) renderMathInElement(root, { delimiters: [{ left: "$$", right: "$$", display: true }, { left: "$", right: "$", display: false }], throwOnError: false, ignoredTags: ["script", "noscript", "style", "textarea", "pre", "code"] });
    if (window.mermaid && root.querySelector(".mermaid")) mermaid.run({ nodes: root.querySelectorAll(".mermaid") }).catch(() => {});
  }

  // ---------- 目录树 ----------
  async function loadTree() {
    tree = await data.tree();
    const stats = await data.stats();
    $("#stats").textContent = `${stats.documents} 篇文档 · ${stats.chunks} 个段落`;
    flatFiles = []; treeEl.innerHTML = "";
    const knowledge = tree.dirs.find((d) => d.name === "Knowledge");
    const groups = knowledge ? knowledge.dirs : tree.dirs.filter((d) => d.name !== "templates");
    const kIndex = knowledge?.files.find((f) => /00-README\.md$/.test(f.name));
    if (kIndex) treeEl.appendChild(fileLink(kIndex, "🗺️"));
    for (const d of groups) treeEl.appendChild(groupNode(d, true));
    const about = { name: "关于知识库", files: tree.files.filter((f) => /^(README|STANDARD)\.md$/.test(f.path)), dirs: [] };
    if (about.files.length) treeEl.appendChild(groupNode(about, false, "📘 关于知识库"));
    highlightActive();
    renderHome();
  }
  const sortFiles = (files) => [...files].sort((a, b) => (a.chapter ?? 99) - (b.chapter ?? 99) || a.name.localeCompare(b.name));
  function groupNode(d, open, labelOverride) {
    const g = document.createElement("div"); g.className = "group" + (open ? " open" : "");
    const readme = d.files.find((f) => /00-README\.md$/i.test(f.name));
    const label = labelOverride || (readme ? readme.title.replace(/[（(].*?[)）]/g, "").trim() : d.name);
    const count = countFiles(d);
    const title = document.createElement("button"); title.type = "button"; title.className = "group-title";
    title.innerHTML = `<span class="chev">▶</span><span>${escapeHtml(label)}</span><span class="count">${count}</span>`;
    title.addEventListener("click", () => { g.classList.toggle("open"); if (readme && g.classList.contains("open") && !currentPath.startsWith(d.path + "/")) location.hash = "#/" + readme.path; });
    g.appendChild(title);
    const body = document.createElement("div"); body.className = "group-body";
    if (readme) body.appendChild(fileLink(readme, "📑", "目录"));
    for (const sub of d.dirs) { const s = groupNode(sub, false); s.classList.add("sub"); body.appendChild(s); }
    for (const f of sortFiles(d.files)) if (!readme || f.path !== readme.path) body.appendChild(fileLink(f));
    g.appendChild(body);
    return g;
  }
  const countFiles = (d) => d.files.filter((f) => !/00-README\.md$/i.test(f.name)).length + d.dirs.reduce((a, s) => a + countFiles(s), 0);
  function fileLink(f, icon, labelOverride) {
    flatFiles.push(f);
    const a = document.createElement("a"); a.className = "file"; a.href = "#/" + f.path; a.dataset.path = f.path;
    const num = f.chapter != null && f.chapter > 0 ? String(f.chapter).padStart(2, "0") : (icon || "");
    const title = labelOverride || f.title.replace(/[（(]目录[)）]/g, "");
    a.innerHTML = `<span class="num">${escapeHtml(num)}</span><span class="t">${escapeHtml(title)}</span>` + (f.level && f.level !== "all" ? `<span class="dot ${f.level}" title="${f.level}"></span>` : "");
    return a;
  }
  function highlightActive() {
    treeEl.querySelectorAll(".file").forEach((el) => el.classList.toggle("active", el.dataset.path === currentPath));
    const active = treeEl.querySelector(".file.active");
    if (active) { let p = active.parentElement; while (p && p !== treeEl) { if (p.classList.contains("group")) p.classList.add("open"); p = p.parentElement; } active.scrollIntoView({ block: "nearest" }); }
  }

  // ---------- 首页 ----------
  function renderHome() {
    const knowledge = tree.dirs.find((d) => d.name === "Knowledge");
    const groups = knowledge ? knowledge.dirs : tree.dirs;
    const icons = { LinuxCommand: "🐧", VLA: "🤖", WAM: "🌍", UR: "🦾", Papers: "📄", notes: "📝" };
    const cards = groups.map((d) => {
      const readme = d.files.find((f) => /00-README\.md$/i.test(f.name));
      const label = readme ? readme.title.replace(/[（(].*?[)）]/g, "").trim() : d.name;
      const n = countFiles(d);
      return `<a class="card" href="#/${readme ? readme.path : ""}"><div class="icon">${icons[d.name] || "📁"}</div><h3>${escapeHtml(label)}</h3><p>${escapeHtml(d.path)}</p><div class="meta">${n} 章${d.dirs.length ? ` · ${d.dirs.length} 个子主题` : ""}</div></a>`;
    }).join("");
    const kIndex = knowledge?.files.find((f) => /00-README\.md$/.test(f.name));
    contentEl.dataset.home = `<div class="hero"><h1>从零开始的学习知识库</h1><p>按章节循序渐进，每章有练习与自测；右上角的助教可以答疑、出题、帮你整理笔记。</p><p class="muted small">快捷键：<kbd>⌘K</kbd> 搜索 · <kbd>[</kbd> 目录 · <kbd>]</kbd> 助教 · <kbd>←</kbd><kbd>→</kbd> 上一章/下一章</p></div><div class="cards">${cards}</div>${kIndex ? `<p style="margin-top:24px"><a href="#/${kIndex.path}">查看完整学习路线 →</a></p>` : ""}`;
    if (!hashPath()) showHome();
  }
  function showHome() { currentPath = ""; contentEl.innerHTML = contentEl.dataset.home || ""; tocEl.innerHTML = ""; document.title = "Learning 知识库"; highlightActive(); }

  // ---------- 文档页 ----------
  async function showDoc(path, hash) {
    const doc = await data.doc(path);
    if (!doc) { contentEl.innerHTML = `<div class="doc-head"><h1>找不到文档</h1></div><p>${escapeHtml(path)}</p>`; tocEl.innerHTML = ""; return; }
    currentPath = doc.path;
    const m = doc.meta;
    let body = doc.body;
    const h1 = body.match(/^#\s+(.+)$/m);
    const title = h1 ? h1[1] : doc.title;
    if (h1) body = body.replace(h1[0], "");
    const crumbs = doc.path.split("/").slice(0, -1).map((seg, i, arr) => { const p = arr.slice(0, i + 1).join("/"); const idx = flatFiles.find((f) => f.path === `${p}/00-README.md`); return idx ? `<a href="#/${idx.path}">${escapeHtml(seg)}</a>` : `<span>${escapeHtml(seg)}</span>`; }).join("<span>›</span>");
    const pills = [
      m.level && `<span class="pill ${escapeHtml(m.level)}">${escapeHtml(m.level)}</span>`,
      m.type && `<span class="pill tag">${escapeHtml(m.type)}</span>`,
      m.status && `<span class="pill status-${escapeHtml(m.status)}">${escapeHtml(m.status)}</span>`,
      m.estimated_time && `<span class="pill tag">⏱ ${escapeHtml(m.estimated_time)}</span>`,
      m.updated && `<span class="pill tag">更新 ${escapeHtml(m.updated)}</span>`,
      ...(m.tags || []).map((t) => `<span class="pill tag">#${escapeHtml(t)}</span>`),
    ].filter(Boolean).join("");
    contentEl.innerHTML = `<div class="crumbs">${crumbs}</div><div class="doc-head"><h1>${renderInline(title)}</h1><div class="pills">${pills}</div></div>${renderMarkdown(body, doc.path)}${relatedBox(doc)}${pager(doc.path)}`;
    postProcess(contentEl);
    buildToc();
    highlightActive();
    document.title = `${title.replace(/[*_`]/g, "")} · Learning 知识库`;
    if (hash) { const t = contentEl.querySelector(`#${CSS.escape(decodeURIComponent(hash))}`) || [...contentEl.querySelectorAll("h2,h3")].find((h) => h.textContent.trim() === decodeURIComponent(hash)); t?.scrollIntoView(); }
    else mainEl.scrollTo(0, 0);
    if (isMobile()) layout.classList.remove("nav-open");
  }
  // 论文 ↔ 知识章节的双向关联（来自论文 frontmatter 的 related，见 STANDARD.md 第 11 节）
  function relatedBox(doc) {
    const item = (d) => `<li><a href="#/${d.path}">${escapeHtml(d.title)}</a>${d.year ? ` <span class="muted small">${escapeHtml(String(d.year))}</span>` : ""}${d.status ? ` <span class="pill status-${escapeHtml(d.status)}">${escapeHtml(d.status)}</span>` : ""}</li>`;
    const box = (title, list) => (list?.length ? `<section class="related-box"><div class="related-title">${title}</div><ul>${list.map(item).join("")}</ul></section>` : "");
    return box("🔗 关联的知识章节", doc.related) + box("📄 相关论文", doc.relatedPapers);
  }
  const renderInline = (s) => (hasMarked ? marked.parseInline(s) : escapeHtml(s));
  function siblings(path) {
    const dir = path.slice(0, path.lastIndexOf("/"));
    return sortFiles(flatFiles.filter((f) => f.path.slice(0, f.path.lastIndexOf("/")) === dir));
  }
  function pager(path) {
    const sib = siblings(path); const i = sib.findIndex((f) => f.path === path);
    const prev = sib[i - 1], next = sib[i + 1];
    return `<nav class="pager">${prev ? `<a class="prev" href="#/${prev.path}"><span class="lbl">← 上一章</span><span class="ttl">${escapeHtml(prev.title)}</span></a>` : "<span></span>"}${next ? `<a class="next" href="#/${next.path}"><span class="lbl">下一章 →</span><span class="ttl">${escapeHtml(next.title)}</span></a>` : ""}</nav>`;
  }
  let tocObserver = null;
  function buildToc() {
    const hs = [...contentEl.querySelectorAll("h2, h3")];
    tocObserver?.disconnect();
    if (hs.length < 2) { tocEl.innerHTML = ""; return; }
    tocEl.innerHTML = `<div class="toc-title">本页目录</div>` + hs.map((h) => `<a class="${h.tagName.toLowerCase()}" href="#/${currentPath}#${h.id}" data-id="${h.id}">${escapeHtml(h.textContent)}</a>`).join("");
    tocEl.querySelectorAll("a").forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); contentEl.querySelector(`#${CSS.escape(a.dataset.id)}`)?.scrollIntoView({ behavior: "smooth", block: "start" }); }));
    tocObserver = new IntersectionObserver((entries) => {
      for (const en of entries) if (en.isIntersecting) { tocEl.querySelectorAll("a").forEach((a) => a.classList.toggle("active", a.dataset.id === en.target.id)); break; }
    }, { root: mainEl, rootMargin: "-10% 0px -80% 0px" });
    hs.forEach((h) => tocObserver.observe(h));
  }
  mainEl.addEventListener("scroll", () => { const p = mainEl.scrollTop / Math.max(1, mainEl.scrollHeight - mainEl.clientHeight); $("#progress").style.width = `${Math.min(100, p * 100)}%`; });

  // ---------- 搜索 ----------
  const hl = (s, q) => { let h = escapeHtml(s); for (const t of q.split(/\s+/).filter((x) => x.length > 1)) h = h.replace(new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), (m) => `<mark>${m}</mark>`); return h; };
  async function showSearch(q) {
    const hits = await data.search(q, 30);
    currentPath = ""; tocEl.innerHTML = "";
    contentEl.innerHTML = `<div class="doc-head"><h1>搜索：${escapeHtml(q)}</h1><div class="muted">${hits.length} 条结果</div></div>` + (hits.length ? hits.map((h) => `<div class="hit"><a class="ttl" href="#/${h.relPath}#${slug(h.heading)}">${escapeHtml(h.title)}</a><div class="where">${escapeHtml(h.relPath)} › ${escapeHtml(h.heading)}</div><div class="snip">${hl(h.snippet, q)}</div></div>`).join("") : `<p class="muted">没有结果。试试换个关键词，或者问右上角的助教。</p>`);
    document.title = `搜索 ${q} · Learning 知识库`; highlightActive();
  }
  const palette = $("#palette"), pInput = $("#paletteInput"), pRes = $("#paletteResults");
  let pSel = 0, pHits = [], pTimer = null;
  function openPalette() { palette.hidden = false; pInput.value = ""; pRes.innerHTML = `<div class="empty">输入关键词开始搜索</div>`; setTimeout(() => pInput.focus(), 0); }
  function closePalette() { palette.hidden = true; }
  $("#searchBtn").addEventListener("click", openPalette);
  palette.addEventListener("click", (e) => { if (e.target === palette) closePalette(); });
  pInput.addEventListener("input", () => { clearTimeout(pTimer); pTimer = setTimeout(async () => {
    const q = pInput.value.trim(); if (!q) { pRes.innerHTML = `<div class="empty">输入关键词开始搜索</div>`; return; }
    pHits = await data.search(q, 12); pSel = 0; renderPalette(q);
  }, 150); });
  function renderPalette(q) {
    pRes.innerHTML = pHits.length ? pHits.map((h, i) => `<div class="r${i === pSel ? " sel" : ""}" data-i="${i}"><div class="ttl">${escapeHtml(h.title)}</div><div class="where">${escapeHtml(h.relPath)} › ${escapeHtml(h.heading)}</div><div class="snip">${hl(h.snippet, q)}</div></div>`).join("") : `<div class="empty">没有结果</div>`;
    pRes.querySelectorAll(".r").forEach((r) => r.addEventListener("click", () => goHit(pHits[Number(r.dataset.i)])));
  }
  function goHit(h) { if (!h) return; closePalette(); location.hash = `#/${h.relPath}#${slug(h.heading)}`; }
  pInput.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); pSel = Math.min(pHits.length - 1, pSel + 1); renderPalette(pInput.value.trim()); }
    else if (e.key === "ArrowUp") { e.preventDefault(); pSel = Math.max(0, pSel - 1); renderPalette(pInput.value.trim()); }
    else if (e.key === "Enter") { e.preventDefault(); if (pHits.length) goHit(pHits[pSel]); else if (pInput.value.trim()) { closePalette(); location.hash = "#/search=" + encodeURIComponent(pInput.value.trim()); } }
    else if (e.key === "Escape") closePalette();
  });

  // ---------- 路由 ----------
  const hashPath = () => location.hash.replace(/^#\/?/, "");
  function route() {
    const h = hashPath();
    if (!h) return showHome();
    if (h.startsWith("search=")) return showSearch(decodeURIComponent(h.slice(7)));
    const [p, hash] = h.split("#");
    showDoc(decodeURIComponent(p), hash);
  }
  window.addEventListener("hashchange", route);

  // ---------- 助教 ----------
  const setChat = (open) => { document.body.classList.toggle("chat-open", open); if (open) setTimeout(() => $("#chatInput").focus(), 200); };
  $("#toggleChat").addEventListener("click", () => setChat(!document.body.classList.contains("chat-open")));
  $("#closeChat").addEventListener("click", () => setChat(false));
  $("#clearChat").addEventListener("click", () => { history = []; chatLog.querySelectorAll(".msg").forEach((m) => m.remove()); $("#chatEmpty").hidden = false; });
  document.querySelectorAll(".chip").forEach((c) => c.addEventListener("click", () => sendChat(c.dataset.q)));
  const input = $("#chatInput");
  input.addEventListener("input", () => { input.style.height = "auto"; input.style.height = Math.min(160, input.scrollHeight) + "px"; });
  input.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("#chatForm").requestSubmit(); } });
  $("#chatForm").addEventListener("submit", (e) => { e.preventDefault(); const v = input.value; input.value = ""; input.style.height = "auto"; sendChat(v); });

  function addMsg(role) {
    $("#chatEmpty").hidden = true;
    const div = document.createElement("div"); div.className = `msg ${role}`;
    div.innerHTML = `<div class="avatar">${role === "user" ? "我" : "🤖"}</div><div class="bubble">${role === "assistant" ? `<div class="tools"></div><div class="body"><span class="typing"></span></div>` : ""}</div>`;
    chatLog.appendChild(div); chatLog.scrollTop = chatLog.scrollHeight; return div;
  }
  function renderAssistant(div, text, done) {
    const body = div.querySelector(".body");
    body.innerHTML = renderMarkdown(text, "") + (done ? "" : `<span class="typing"></span>`);
    postProcess(body);
  }
  async function sendChat(text) {
    text = (text || "").trim(); if (!text) return;
    setChat(true);
    const withCtx = $("#withContext").checked && currentPath;
    const content = withCtx ? `${text}\n\n（我正在阅读：${currentPath}）` : text;
    history.push({ role: "user", content });
    const u = addMsg("user"); u.querySelector(".bubble").textContent = text;
    const div = addMsg("assistant"); const toolsEl = div.querySelector(".tools");
    let acc = "", last = 0;
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messages: history }) });
      if (!res.ok) throw new Error((await res.json()).error || res.statusText);
      for await (const ev of readSSE(res)) {
        if (ev.type === "text") { acc += ev.text; if (Date.now() - last > 80) { renderAssistant(div, acc, false); last = Date.now(); chatLog.scrollTop = chatLog.scrollHeight; } }
        else if (ev.type === "tool_call") { const s = document.createElement("span"); s.textContent = `🔧 ${ev.name}${ev.input?.query ? ": " + ev.input.query : ev.input?.path ? ": " + ev.input.path : ""}`; toolsEl.appendChild(s); }
        else if (ev.type === "status") { const s = document.createElement("span"); s.textContent = `ℹ️ ${ev.text}`; toolsEl.appendChild(s); }
        else if (ev.type === "error") acc += `\n\n> ⚠️ 出错：${ev.message}`;
        else if (ev.type === "done") acc = ev.text || acc;
      }
    } catch (err) { acc += `\n\n> ⚠️ 请求失败：${err.message}`; }
    renderAssistant(div, acc || "（无回复）", true);
    history.push({ role: "assistant", content: acc });
    chatLog.scrollTop = chatLog.scrollHeight;
  }
  async function* readSSE(res) {
    const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = "";
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      buf += dec.decode(value, { stream: true }); let i;
      while ((i = buf.indexOf("\n\n")) >= 0) { const chunk = buf.slice(0, i); buf = buf.slice(i + 2); const line = chunk.split("\n").find((l) => l.startsWith("data: ")); if (line) { try { yield JSON.parse(line.slice(6)); } catch {} } }
    }
  }

  // ---------- 导入论文 ----------
  const dlg = $("#importDialog");
  $("#importBtn").addEventListener("click", async () => {
    const dirs = await (await fetch("/api/dirs")).json();
    $("#dirList").innerHTML = dirs.map((d) => `<option value="${escapeHtml(d)}">`).join("");
    $("#importProgress").hidden = true; $("#importProgress").textContent = ""; dlg.showModal();
  });
  $("#importCancel").addEventListener("click", () => dlg.close());
  $("#importForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const url = $("#paperUrl").value.trim(), file = $("#paperFile").files[0];
    const targetDir = $("#paperDir").value.trim() || "Knowledge/Papers/VLA", topic = $("#paperTopic").value.trim();
    if (!url && !file) return alert("请填写链接或选择 PDF");
    const body = { targetDir, topic }; if (file) body.base64 = await fileToBase64(file); else body.url = url;
    const prog = $("#importProgress"); prog.hidden = false; prog.textContent = "正在读取论文并生成笔记（通常需要 1~3 分钟）…\n\n";
    try {
      const res = await fetch("/api/paper", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      for await (const ev of readSSE(res)) {
        if (ev.type === "text") { prog.textContent += ev.text; prog.scrollTop = prog.scrollHeight; }
        else if (ev.type === "error") prog.textContent += `\n\n⚠️ ${ev.message}`;
        else if (ev.type === "done") { prog.textContent += `\n\n✅ 已保存：${ev.relPath}`; await loadTree(); setTimeout(() => { dlg.close(); location.hash = "#/" + ev.relPath; }, 800); }
      }
    } catch (err) { prog.textContent += `\n\n⚠️ ${err.message}`; }
  });
  const fileToBase64 = (file) => new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result.split(",")[1]); r.onerror = reject; r.readAsDataURL(file); });

  // ---------- 快捷键 ----------
  $("#toggleNav").addEventListener("click", () => layout.classList.toggle(isMobile() ? "nav-open" : "nav-hidden"));
  document.addEventListener("keydown", (e) => {
    const typing = ["TEXTAREA", "INPUT"].includes(document.activeElement.tagName);
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); palette.hidden ? openPalette() : closePalette(); return; }
    if (e.key === "Escape") { closePalette(); layout.classList.remove("nav-open"); if (document.activeElement === input) setChat(false); return; }
    if (typing) return;
    if (e.key === "/") { e.preventDefault(); openPalette(); }
    else if (e.key === "[") layout.classList.toggle(isMobile() ? "nav-open" : "nav-hidden");
    else if (e.key === "]") STATIC ? window.open(LOCAL_URL + location.hash, "_blank") : setChat(!document.body.classList.contains("chat-open"));
    else if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && currentPath) {
      const sib = siblings(currentPath); const i = sib.findIndex((f) => f.path === currentPath); const t = sib[e.key === "ArrowLeft" ? i - 1 : i + 1]; if (t) location.hash = "#/" + t.path;
    }
  });
  if (isMobile() && !hashPath()) layout.classList.add("nav-open");

  if (STATIC) {
    // 公网静态站没有后端：隐藏导入，助教按钮跳到本机版（Mac 上开机自启的 http://localhost:8787）
    $("#importBtn").hidden = true;
    const btn = $("#toggleChat"); btn.textContent = "💬 助教（本机）"; btn.title = "AI 助教只在你电脑上的本机版可用";
    btn.replaceWith(btn.cloneNode(true));
    $("#toggleChat").addEventListener("click", () => window.open(LOCAL_URL + location.hash, "_blank"));
  } else {
    fetch("/api/health").then((r) => r.json()).then((h) => { $("#chatModel").textContent = h.model; }).catch(() => {});
  }
  loadTree().then(route).catch((err) => { $("#stats").textContent = "目录加载失败：" + err.message; contentEl.innerHTML = `<div class="doc-head"><h1>目录加载失败</h1></div><p>${escapeHtml(err.message)}</p><p>请确认服务已启动（终端里 ./start.sh），然后刷新。</p>`; });
})();
