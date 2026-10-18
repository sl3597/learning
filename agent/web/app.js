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
      // 页内锚点 [x](#标题)：hash 路由下要带上当前文档路径，否则会被当成文档名
      if (href.startsWith("#") && currentPath) return `<a href="#/${currentPath}${href}"${t}>${text}</a>`;
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

  // ---------- 分类元数据：侧栏、首页、分类浏览共用 ----------
  // 顶层文件夹 → 短名、图标、主题色、学习顺序；没登记的文件夹自动用它目录页的标题
  const SECTIONS = {
    LinuxCommand: { label: "Linux 命令", icon: "🐧", color: "#16a34a", order: 1 },
    VLA: { label: "VLA 模型", icon: "🤖", color: "#4f46e5", order: 2 },
    WAM: { label: "世界模型", icon: "🌍", color: "#0891b2", order: 3 },
    UR: { label: "UR 机械臂", icon: "🦾", color: "#ea580c", order: 4 },
    Papers: { label: "论文库", icon: "📄", color: "#9333ea", order: 90, library: true },
  };
  // 子文件夹（相对 Knowledge/）→ 短名与图标；登记顺序就是显示顺序（论文领域与学习路线对齐）
  const SUBS = {
    "VLA/Basic": { label: "基础教程" },
    "VLA/ForceVLA": { label: "ForceVLA 精读" },
    "Papers/VLA": { label: "VLA 论文", icon: "🤖" },
    "Papers/WAM": { label: "世界模型论文", icon: "🌍" },
    "Papers/Robotics": { label: "机器人学习论文", icon: "🛠" },
  };
  const subKey = (d) => d.path.replace(/^Knowledge\//, "");
  const subRank = (d) => { const i = Object.keys(SUBS).indexOf(subKey(d)); return i < 0 ? 99 : i; };
  const sortDirs = (dirs) => [...dirs].sort((a, b) => subRank(a) - subRank(b) || a.name.localeCompare(b.name));
  const TYPE_LABEL = { tutorial: "教程", "paper-note": "论文", hardware: "硬件", reference: "参考", index: "目录" };
  const LEVEL_LABEL = { beginner: "入门", intermediate: "进阶", advanced: "高级", all: "通用" };
  const STATUS_LABEL = { draft: "草稿", reviewed: "已复核", stable: "稳定" };
  const ORDER = { type: ["tutorial", "paper-note", "hardware", "reference", "index"], level: ["beginner", "intermediate", "advanced", "all"], status: ["draft", "reviewed", "stable"] };
  const isReadme = (f) => /00-README\.md$/i.test(f.name);
  const isDone = (f) => f.status === "reviewed" || f.status === "stable";
  const allFiles = (d) => (d ? [...d.files, ...d.dirs.flatMap(allFiles)] : []);
  const countFiles = (d) => allFiles(d).filter((f) => !isReadme(f)).length;
  const sortFiles = (files) => [...files].sort((a, b) => (a.chapter ?? 99) - (b.chapter ?? 99) || a.name.localeCompare(b.name));
  const minutesOf = (t) => { const m = String(t ?? "").match(/(\d+(?:\.\d+)?)\s*(min|h)/i); return m ? Math.round(Number(m[1]) * (m[2].toLowerCase() === "h" ? 60 : 1)) : 0; };
  const fmtTime = (min) => (min >= 60 ? `${Math.round(min / 6) / 10} 小时` : `${min} 分钟`);
  let knowledge = null;
  let sections = [];
  function sectionMeta(dir) {
    const m = SECTIONS[dir.name];
    const readme = dir.files.find(isReadme);
    const fallback = readme ? readme.title.replace(/[（(].*?[)）]/g, "").replace(/(主题)?(总)?(目录|总览|学习路线)$/, "").trim() : dir.name;
    return { key: dir.name, label: m?.label ?? fallback, icon: m?.icon ?? "📁", color: m?.color ?? "#64748b", order: m?.order ?? 50, library: Boolean(m?.library), readme, dir };
  }
  const subLabel = (d) => SUBS[subKey(d)]?.label ?? sectionMeta(d).label;
  /** 文档所在的顶层主题；根目录的 README / STANDARD 归到"关于" */
  const sectionOf = (path) => { const p = path.split("/"); return p[0] === "Knowledge" && p.length > 2 ? sections.find((s) => s.key === p[1]) ?? null : null; };
  const firstChapter = (d) => sortFiles(d.files).find((f) => !isReadme(f)) ?? d.dirs.map(firstChapter).find(Boolean) ?? null;

  // ---------- 侧栏 ----------
  // 用户手动展开的分组会记住；当前文档所在的分组总是展开
  const navOpen = new Set((() => { try { return JSON.parse(store.get("navOpen") || "[]"); } catch { return []; } })());
  async function loadTree() {
    tree = await data.tree();
    knowledge = tree.dirs.find((d) => d.name === "Knowledge") ?? null;
    sections = (knowledge?.dirs ?? []).map(sectionMeta).sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
    flatFiles = []; treeEl.innerHTML = "";
    const heading = (t) => Object.assign(document.createElement("div"), { className: "nav-heading", textContent: t });
    const kIndex = knowledge?.files.find(isReadme);
    treeEl.appendChild(heading("学习路线"));
    if (kIndex) treeEl.appendChild(fileLink(kIndex, "🗺️", "总路线图"));
    for (const s of sections.filter((x) => !x.library)) treeEl.appendChild(groupNode(s.dir, s));
    for (const s of sections.filter((x) => x.library)) {
      // 论文库：领域子目录直接作为分组，层级更浅
      treeEl.appendChild(heading(s.label));
      if (s.readme) treeEl.appendChild(fileLink(s.readme, "📚", "论文库总览"));
      for (const sub of sortDirs(s.dir.dirs)) treeEl.appendChild(groupNode(sub, { ...s, label: subLabel(sub), icon: SUBS[subKey(sub)]?.icon ?? s.icon }));
    }
    const about = tree.files.filter((f) => /^(README|STANDARD)\.md$/.test(f.path));
    if (about.length) { treeEl.appendChild(heading("关于")); for (const f of about) treeEl.appendChild(fileLink(f, f.path === "README.md" ? "📘" : "📏")); }
    const all = allFiles(knowledge).filter((f) => !isReadme(f));
    $("#stats").textContent = `${all.length} 篇文档 · ${all.filter((f) => f.type === "paper-note").length} 篇论文 · ${all.filter(isDone).length} 篇已复核`;
    highlightActive();
    if (!hashPath()) showHome();
  }
  function groupNode(d, meta, depth = 0) {
    const g = document.createElement("div");
    g.className = `group depth-${depth}`; g.dataset.key = d.path;
    if (depth === 0) g.style.setProperty("--sec", meta.color);
    if (navOpen.has(d.path)) g.classList.add("open");
    const readme = d.files.find(isReadme);
    const label = depth ? subLabel(d) : meta.label;
    const title = document.createElement("button"); title.type = "button"; title.className = "group-title";
    title.innerHTML = `${depth ? "" : `<span class="sec-icon">${meta.icon}</span>`}<span class="label">${escapeHtml(label)}</span><span class="count">${countFiles(d)}</span><span class="chev" aria-hidden="true"></span>`;
    title.addEventListener("click", () => setGroupOpen(g, !g.classList.contains("open"), true));
    const body = document.createElement("div"); body.className = "group-body";
    const inner = document.createElement("div"); inner.className = "group-inner";
    if (readme) inner.appendChild(fileLink(readme, "◎", "概览"));
    for (const sub of sortDirs(d.dirs)) inner.appendChild(groupNode(sub, meta, depth + 1));
    for (const f of sortFiles(d.files)) if (f !== readme) inner.appendChild(fileLink(f));
    body.appendChild(inner); g.append(title, body);
    title.setAttribute("aria-expanded", String(g.classList.contains("open")));
    return g;
  }
  function setGroupOpen(g, open, remember) {
    g.classList.toggle("open", open);
    g.querySelector(":scope > .group-title").setAttribute("aria-expanded", String(open));
    if (!remember) return;
    if (open) navOpen.add(g.dataset.key); else navOpen.delete(g.dataset.key);
    store.set("navOpen", JSON.stringify([...navOpen]));
  }
  function fileLink(f, icon, labelOverride) {
    flatFiles.push(f);
    const a = document.createElement("a"); a.className = "file"; a.href = "#/" + f.path; a.dataset.path = f.path;
    a.dataset.search = `${f.title} ${(f.tags || []).join(" ")}`.toLowerCase();
    const lead = icon ?? (f.type === "paper-note" ? "📄" : f.type === "hardware" ? "🛠" : f.chapter > 0 ? String(f.chapter).padStart(2, "0") : "·");
    const title = labelOverride || f.title.replace(/[（(]目录[)）]/g, "");
    a.title = [f.title, LEVEL_LABEL[f.level], STATUS_LABEL[f.status], f.estimated_time].filter(Boolean).join(" · ");
    a.innerHTML = `<span class="num">${escapeHtml(lead)}</span><span class="t">${escapeHtml(title)}</span>` + (isDone(f) ? `<b class="ok" aria-label="已复核">✓</b>` : "") + (f.level && f.level !== "all" ? `<i class="dot ${f.level}"></i>` : "");
    return a;
  }
  function highlightActive() {
    treeEl.querySelectorAll(".file").forEach((el) => el.classList.toggle("active", el.dataset.path === currentPath));
    $("#navBrowse").classList.toggle("active", hashPath().startsWith("browse"));
    const active = treeEl.querySelector(".file.active");
    if (!active) return;
    for (let p = active.parentElement; p && p !== treeEl; p = p.parentElement) if (p.classList.contains("group")) setGroupOpen(p, true, false);
    active.scrollIntoView({ block: "nearest" });
  }
  // 侧栏筛选：按标题和标签过滤，命中的分组自动展开；清空后恢复原来的展开状态
  const navFilter = $("#navFilter");
  function applyNavFilter() {
    const q = navFilter.value.trim().toLowerCase();
    treeEl.classList.toggle("filtering", Boolean(q));
    treeEl.querySelectorAll(".file").forEach((a) => (a.hidden = Boolean(q) && !a.dataset.search.includes(q)));
    [...treeEl.querySelectorAll(".group")].reverse().forEach((g) => {
      const hit = Boolean(g.querySelector(".file:not([hidden])"));
      g.hidden = Boolean(q) && !hit;
      setGroupOpen(g, q ? hit : navOpen.has(g.dataset.key) || g.contains(treeEl.querySelector(".file.active")), false);
    });
    $("#navEmpty").hidden = !q || Boolean(treeEl.querySelector(".file:not([hidden])"));
  }
  navFilter.addEventListener("input", applyNavFilter);
  navFilter.addEventListener("keydown", (e) => { if (e.key === "Escape") { navFilter.value = ""; applyNavFilter(); navFilter.blur(); } });

  // ---------- 首页 ----------
  const lastDoc = () => { try { return JSON.parse(store.get("lastDoc") || "null"); } catch { return null; } };
  function statusBar(files) {
    const n = Math.max(1, files.length);
    const st = files.filter((f) => f.status === "stable").length, rv = files.filter((f) => f.status === "reviewed").length;
    return `<div class="sbar" title="稳定 ${st} · 已复核 ${rv} · 草稿 ${files.length - st - rv}"><span class="seg stable" style="width:${(st / n) * 100}%"></span><span class="seg reviewed" style="width:${(rv / n) * 100}%"></span></div><span class="sbar-label">已复核 ${st + rv}/${files.length}</span>`;
  }
  function topicCard(s, step) {
    const files = allFiles(s.dir).filter((f) => !isReadme(f));
    const mins = files.reduce((a, f) => a + minutesOf(f.estimated_time), 0);
    const levels = ["beginner", "intermediate", "advanced"].map((l) => [l, files.filter((f) => f.level === l).length]).filter(([, n]) => n);
    const first = firstChapter(s.dir);
    const subs = sortDirs(s.dir.dirs).map((d) => { const r = d.files.find(isReadme); return `<a class="sub-chip" href="#/${r ? r.path : firstChapter(d)?.path ?? ""}">${escapeHtml(subLabel(d))}<b>${countFiles(d)}</b></a>`; }).join("");
    return `<article class="topic-card" style="--sec:${s.color}">
      <div class="tc-head"><span class="sec-icon lg">${s.icon}</span><span class="tc-step">第 ${step} 站</span></div>
      <h3><a href="#/${s.readme?.path ?? first?.path ?? ""}">${escapeHtml(s.label)}</a></h3>
      <p class="tc-sum">${escapeHtml(s.readme?.summary ?? "")}</p>
      <div class="tc-meta"><span>📑 ${files.length} 篇</span>${mins ? `<span>⏱ 约 ${fmtTime(mins)}</span>` : ""}</div>
      <div class="tc-levels">${levels.map(([l, n]) => `<span><i class="dot ${l}"></i>${LEVEL_LABEL[l]} ${n}</span>`).join("")}</div>
      ${subs ? `<div class="tc-subs">${subs}</div>` : ""}
      <div class="tc-progress">${statusBar(files)}</div>
      <div class="tc-actions">${first ? `<a class="btn small primary" href="#/${first.path}">开始学习 →</a>` : ""}<a class="btn small" href="#/browse?section=${encodeURIComponent(s.key)}">全部章节</a></div>
    </article>`;
  }
  /** 首页每次打开都重新生成（"继续阅读"要反映最近读过的文档） */
  function homeHtml() {
    const docs = allFiles(knowledge).filter((f) => !isReadme(f));
    const papers = docs.filter((f) => f.type === "paper-note").sort((a, b) => Number(b.year ?? 0) - Number(a.year ?? 0));
    const learn = sections.filter((s) => !s.library);
    const lib = sections.find((s) => s.library);
    const tagCount = new Map();
    for (const f of docs) for (const t of f.tags || []) tagCount.set(t, (tagCount.get(t) ?? 0) + 1);
    const tags = [...tagCount].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]).slice(0, 28);
    const resume = lastDoc();
    const resumeOk = resume && flatFiles.some((f) => f.path === resume.path);
    const stat = (n, l) => `<div class="stat"><b>${n}</b><span>${l}</span></div>`;
    const kIndex = knowledge?.files.find(isReadme);
    const paperItem = (f) => { const s = sectionOf(f.path); return `<a class="paper-item" href="#/${f.path}"><span class="pi-year">${escapeHtml(String(f.year ?? "—"))}</span><span class="pi-body"><b>${escapeHtml(f.title)}</b><span>${escapeHtml(f.summary ?? "")}</span></span>${s && !s.library ? `<span class="sec-chip" style="--sec:${s.color}">${s.icon} ${escapeHtml(s.label)}精读</span>` : ""}</a>`; };
    return `
      <section class="hero">
        <h1>从零开始的学习知识库</h1>
        <p>按章节循序渐进，每章有练习与自测；遇到不懂的随时问助教，读到的论文会自动挂到相关章节上。</p>
        <div class="stats">${stat(learn.length, "学习主题")}${stat(docs.length, "篇文档")}${stat(papers.length, "篇论文")}${stat(docs.filter(isDone).length, "篇已复核")}</div>
        ${resumeOk ? `<a class="resume" href="#/${resume.path}"><span>继续阅读</span><b>${escapeHtml(resume.title)}</b><span aria-hidden="true">→</span></a>` : ""}
      </section>
      <section class="home-sec">
        <div class="home-sec-head"><h2>学习路线</h2>${kIndex ? `<a href="#/${kIndex.path}">查看完整路线图 →</a>` : ""}</div>
        <div class="route">${learn.map((s, i) => topicCard(s, i + 1)).join("")}</div>
      </section>
      ${lib ? `<section class="home-sec">
        <div class="home-sec-head"><h2>${lib.icon} 论文库</h2><a href="#/browse?type=paper-note">全部论文 →</a></div>
        <div class="domains">${sortDirs(lib.dir.dirs).map((d) => { const r = d.files.find(isReadme); return `<a class="domain" href="#/${r?.path ?? ""}" style="--sec:${lib.color}"><span class="sec-icon">${SUBS[subKey(d)]?.icon ?? lib.icon}</span><span>${escapeHtml(subLabel(d))}</span><b>${countFiles(d)}</b></a>`; }).join("")}</div>
        <div class="paper-list">${papers.slice(0, 6).map(paperItem).join("") || `<p class="muted">还没有论文。</p>`}</div>
      </section>` : ""}
      ${tags.length ? `<section class="home-sec">
        <div class="home-sec-head"><h2>按标签探索</h2><a href="#/browse">分类浏览 →</a></div>
        <div class="tag-cloud">${tags.map(([t, n]) => `<a class="tchip" href="#/browse?tag=${encodeURIComponent(t)}">#${escapeHtml(t)}<b>${n}</b></a>`).join("")}</div>
      </section>` : ""}
      <p class="muted small home-keys">快捷键：<kbd>⌘K</kbd> 搜索 · <kbd>[</kbd> 目录 · <kbd>]</kbd> 助教 · <kbd>←</kbd><kbd>→</kbd> 上一章/下一章</p>`;
  }
  function showHome() { currentPath = ""; contentEl.innerHTML = tree ? homeHtml() : ""; tocEl.innerHTML = ""; document.title = "Learning 知识库"; highlightActive(); mainEl.scrollTo(0, 0); }

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
    // 面包屑用侧栏同样的短名；第一段换成带颜色的主题标签
    const sec = sectionOf(doc.path);
    const crumbs = doc.path.split("/").slice(0, -1).map((seg, i, arr) => {
      const p = arr.slice(0, i + 1).join("/");
      if (p === "Knowledge") return "";
      const idx = flatFiles.find((f) => f.path === `${p}/00-README.md`);
      const label = i === 1 && sec ? `${sec.icon} ${sec.label}` : SUBS[p.replace(/^Knowledge\//, "")]?.label ?? seg;
      const cls = i === 1 && sec ? ` class="sec-chip" style="--sec:${sec.color}"` : "";
      return idx ? `<a${cls} href="#/${idx.path}">${escapeHtml(label)}</a>` : `<span${cls}>${escapeHtml(label)}</span>`;
    }).filter(Boolean).join("<span>›</span>");
    // 元信息都能点：跳到分类浏览里对应的筛选
    const facet = (k, v) => `#/browse?${k}=${encodeURIComponent(v)}`;
    const pills = [
      m.level && `<a class="pill ${escapeHtml(m.level)}" href="${facet("level", m.level)}">${escapeHtml(LEVEL_LABEL[m.level] ?? m.level)}</a>`,
      m.type && `<a class="pill tag" href="${facet("type", m.type)}">${escapeHtml(TYPE_LABEL[m.type] ?? m.type)}</a>`,
      m.status && `<a class="pill status-${escapeHtml(m.status)}" href="${facet("status", m.status)}">${escapeHtml(STATUS_LABEL[m.status] ?? m.status)}</a>`,
      m.estimated_time && `<span class="pill tag">⏱ ${escapeHtml(m.estimated_time)}</span>`,
      m.updated && `<span class="pill tag">更新 ${escapeHtml(m.updated)}</span>`,
      ...(Array.isArray(m.tags) ? m.tags : []).map((t) => `<a class="pill tag hash" href="${facet("tag", t)}">#${escapeHtml(t)}</a>`),
    ].filter(Boolean).join("");
    contentEl.innerHTML = `<div class="crumbs">${crumbs}</div><div class="doc-head"><h1>${renderInline(title)}</h1><div class="pills">${pills}</div></div>${renderMarkdown(body, doc.path)}${relatedBox(doc)}${pager(doc.path)}`;
    postProcess(contentEl);
    buildToc();
    highlightActive();
    document.title = `${title.replace(/[*_`]/g, "")} · Learning 知识库`;
    if (m.type !== "index" && doc.path.startsWith("Knowledge/")) store.set("lastDoc", JSON.stringify({ path: doc.path, title: doc.title }));
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

  // ---------- 分类浏览：#/browse?section=&type=&level=&status=&tag=&q= ----------
  const FACETS = [
    { key: "section", name: "主题", get: (f) => sectionOf(f.path)?.key ?? "_about", label: (v) => (v === "_about" ? "📘 关于" : `${SECTIONS[v]?.icon ?? sections.find((x) => x.key === v)?.icon ?? "📁"} ${sections.find((x) => x.key === v)?.label ?? v}`), order: () => [...sections.map((x) => x.key), "_about"] },
    { key: "type", name: "类型", get: (f) => f.type, label: (v) => TYPE_LABEL[v] ?? v, order: () => ORDER.type },
    { key: "level", name: "难度", get: (f) => f.level, label: (v) => LEVEL_LABEL[v] ?? v, order: () => ORDER.level },
    { key: "status", name: "状态", get: (f) => f.status, label: (v) => STATUS_LABEL[v] ?? v, order: () => ORDER.status },
  ];
  const browseLink = (params, k, v) => { const p = new URLSearchParams(params); if (v == null || p.get(k) === v) p.delete(k); else p.set(k, v); const qs = p.toString(); return `#/browse${qs ? "?" + qs : ""}`; };
  function browsePool() {
    const seen = new Set();
    return flatFiles.filter((f) => !seen.has(f.path) && seen.add(f.path) && !f.path.startsWith("templates/"));
  }
  function browseMatch(f, sel, skip) {
    for (const fc of FACETS) if (fc.key !== skip && sel[fc.key] && fc.get(f) !== sel[fc.key]) return false;
    if (skip !== "type" && !sel.type && f.type === "index") return false; // 目录页默认不列出，选"目录"类型才显示
    if (sel.tag && !(f.tags || []).includes(sel.tag)) return false;
    if (sel.q && !`${f.title} ${f.summary ?? ""} ${(f.tags || []).join(" ")}`.toLowerCase().includes(sel.q)) return false;
    return true;
  }
  function docCard(f) {
    const s = sectionOf(f.path);
    const tags = (f.tags || []).slice(0, 4).map((t) => `<span>#${escapeHtml(t)}</span>`).join("");
    // 结果已按顶层主题分组，卡片上只标更细的一层（如"基础教程""ForceVLA 精读"）
    const p = f.path.split("/");
    const sub = p.length > 3 ? SUBS[`${p[1]}/${p[2]}`]?.label ?? p[2] : "";
    return `<a class="doc-card" href="#/${f.path}" style="--sec:${s?.color ?? "#64748b"}">
      <div class="dc-top"><span class="type-badge t-${escapeHtml(f.type ?? "")}">${escapeHtml(TYPE_LABEL[f.type] ?? f.type ?? "")}</span>${sub ? `<span class="sec-chip">${escapeHtml(sub)}</span>` : ""}${f.chapter > 0 && f.type === "tutorial" ? `<span class="dc-num">第 ${f.chapter} 章</span>` : ""}</div>
      <h3>${escapeHtml(f.title)}</h3>
      ${f.summary ? `<p>${escapeHtml(f.summary)}</p>` : ""}
      <div class="dc-meta">${f.level ? `<span><i class="dot ${escapeHtml(f.level)}"></i>${escapeHtml(LEVEL_LABEL[f.level] ?? f.level)}</span>` : ""}${f.estimated_time ? `<span>⏱ ${escapeHtml(f.estimated_time)}</span>` : ""}${f.year ? `<span>${escapeHtml(String(f.year))}</span>` : ""}<span class="st st-${escapeHtml(f.status ?? "")}">${escapeHtml(STATUS_LABEL[f.status] ?? f.status ?? "")}</span></div>
      ${tags ? `<div class="dc-tags">${tags}</div>` : ""}
    </a>`;
  }
  function showBrowse(qs) {
    const params = new URLSearchParams(qs);
    const sel = { tag: params.get("tag") || "", q: (params.get("q") || "").trim().toLowerCase() };
    for (const fc of FACETS) sel[fc.key] = params.get(fc.key) || "";
    currentPath = ""; tocEl.innerHTML = "";
    const pool = browsePool();
    const facetRow = (fc) => {
      const counts = new Map();
      for (const f of pool) if (browseMatch(f, sel, fc.key)) { const v = fc.get(f); if (v) counts.set(v, (counts.get(v) ?? 0) + 1); }
      const order = fc.order();
      const values = [...new Set([...order.filter((v) => counts.has(v) || v === sel[fc.key]), ...[...counts.keys()].filter((v) => !order.includes(v))])];
      const opts = values.map((v) => `<a class="fchip${sel[fc.key] === v ? " on" : ""}" href="${browseLink(params, fc.key, v)}">${escapeHtml(fc.label(v))}<b>${counts.get(v) ?? 0}</b></a>`).join("");
      return `<div class="facet"><span class="facet-name">${fc.name}</span><div class="facet-opts"><a class="fchip${sel[fc.key] ? "" : " on"}" href="${browseLink(params, fc.key, null)}">全部</a>${opts}</div></div>`;
    };
    // 标签：显示当前结果里最常见的标签，选中的标签固定在最前
    const tagCount = new Map();
    for (const f of pool) if (browseMatch(f, { ...sel, tag: "" })) for (const t of f.tags || []) tagCount.set(t, (tagCount.get(t) ?? 0) + 1);
    const topTags = [...tagCount].sort((a, b) => b[1] - a[1]).slice(0, 18).map(([t]) => t).filter((t) => t !== sel.tag);
    const tagRow = `<div class="facet"><span class="facet-name">标签</span><div class="facet-opts">${sel.tag ? `<a class="fchip on" href="${browseLink(params, "tag", null)}">#${escapeHtml(sel.tag)} ✕</a>` : ""}${topTags.map((t) => `<a class="fchip tagc" href="${browseLink(params, "tag", t)}">#${escapeHtml(t)}<b>${tagCount.get(t)}</b></a>`).join("")}</div></div>`;
    const active = FACETS.some((fc) => sel[fc.key]) || sel.tag || sel.q;
    contentEl.innerHTML = `<div class="doc-head browse-head"><h1>🗂 分类浏览</h1><p class="muted">按主题、类型、难度、状态和标签组合筛选；数字是在其他条件不变时能筛到的篇数。</p></div>
      <div class="facets">
        <div class="facet"><span class="facet-name">关键词</span><div class="facet-opts"><input id="browseQ" class="browse-q" type="search" placeholder="在标题、简介、标签里找…" value="${escapeHtml(params.get("q") || "")}" />${active ? `<a class="clear-all" href="#/browse">清除全部条件</a>` : ""}</div></div>
        ${FACETS.map(facetRow).join("")}${tagRow}
      </div>
      <div id="browseResults"></div>`;
    renderBrowseResults(pool, sel);
    const qInput = $("#browseQ");
    let t = null;
    qInput.addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => {
      // 关键词实时过滤；用 replaceState 同步到网址，不触发整页重绘，输入框不丢焦点
      const p = new URLSearchParams(params); const v = qInput.value.trim(); if (v) p.set("q", v); else p.delete("q");
      window.history.replaceState(null, "", `#/browse${p.toString() ? "?" + p : ""}`); // 注意：本文件的 history 变量是聊天记录
      renderBrowseResults(pool, { ...sel, q: v.toLowerCase() });
    }, 120); });
    document.title = "分类浏览 · Learning 知识库";
    highlightActive();
    mainEl.scrollTo(0, 0);
    if (isMobile()) layout.classList.remove("nav-open");
  }
  function renderBrowseResults(pool, sel) {
    const hits = pool.filter((f) => browseMatch(f, sel));
    const order = new Map(sections.map((x, i) => [x.key, i]));
    const groups = new Map();
    for (const f of hits) { const k = sectionOf(f.path)?.key ?? "_about"; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(f); }
    const keys = [...groups.keys()].sort((a, b) => (order.get(a) ?? 99) - (order.get(b) ?? 99));
    $("#browseResults").innerHTML = hits.length
      ? `<div class="browse-count">共 <b>${hits.length}</b> 篇</div>` + keys.map((k) => {
          const s = sections.find((x) => x.key === k);
          const files = groups.get(k).sort((a, b) => a.path.localeCompare(b.path));
          return `<section class="browse-group" style="--sec:${s?.color ?? "#64748b"}"><h2 class="bg-title"><span class="sec-icon">${s?.icon ?? "📘"}</span>${escapeHtml(s?.label ?? "关于")}<span class="count">${files.length}</span></h2><div class="doc-grid">${files.map(docCard).join("")}</div></section>`;
        }).join("")
      : `<div class="browse-empty"><p>没有符合条件的文档。</p><a class="btn small" href="#/browse">清除全部条件</a></div>`;
  }

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
    if (h === "browse" || h.startsWith("browse?")) return showBrowse(h.slice(7));
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
  $("#navBackdrop").addEventListener("click", () => layout.classList.remove("nav-open"));

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
