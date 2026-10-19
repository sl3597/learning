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
  let editor = null; // 打开中的笔记编辑器 { path, dirty }（见"笔记编辑器"一节）
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
    "VLA/Pi": { label: "π 系列专题" },
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
      <p class="muted small home-keys">快捷键：<kbd>⌘K</kbd> 搜索 · <kbd>[</kbd> 目录 · <kbd>]</kbd> 助教 · <kbd>←</kbd><kbd>→</kbd> 上一章/下一章${STATIC ? "" : " · <kbd>e</kbd> 编辑当前文档 · <kbd>n</kbd> 新建笔记 · <kbd>⌘S</kbd> 保存"}</p>`;
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
    const editBtn = !STATIC && canEdit(doc.path) ? `<a class="btn small ghost edit-btn" href="#/edit/${doc.path}" title="在网页里修改这篇文档（保存后自动重建）">✎ 编辑</a>` : "";
    contentEl.innerHTML = `<div class="crumbs">${crumbs}</div><div class="doc-head"><h1>${renderInline(title)}</h1><div class="pills">${pills}${editBtn}</div></div>${renderMarkdown(body, doc.path)}${relatedBox(doc)}${pager(doc.path)}`;
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
  let pSel = 0, pHits = [], pTimer = null, pMode = "nav"; // nav：打开文档；insert：把选中的章节作为相对链接插进编辑器
  function openPalette(mode = "nav") {
    pMode = mode === "insert" && editor ? "insert" : "nav";
    palette.hidden = false; pInput.value = ""; pInput.placeholder = pMode === "insert" ? "搜索要链接的章节…" : "搜索标题、段落、命令…（支持中英文）";
    $("#paletteFoot").textContent = pMode === "insert" ? "↑↓ 选择 · Enter 插入链接 · Esc 取消" : "↑↓ 选择 · Enter 打开 · Esc 关闭";
    pRes.innerHTML = `<div class="empty">输入关键词开始搜索</div>`; setTimeout(() => pInput.focus(), 0);
  }
  function closePalette() { palette.hidden = true; if (pMode === "insert") { pMode = "nav"; $("#edText")?.focus(); } }
  $("#searchBtn").addEventListener("click", () => openPalette());
  palette.addEventListener("click", (e) => { if (e.target === palette) closePalette(); });
  pInput.addEventListener("input", () => { clearTimeout(pTimer); pTimer = setTimeout(async () => {
    const q = pInput.value.trim(); if (!q) { pRes.innerHTML = `<div class="empty">输入关键词开始搜索</div>`; return; }
    pHits = await data.search(q, 12); pSel = 0; renderPalette(q);
  }, 150); });
  function renderPalette(q) {
    pRes.innerHTML = pHits.length ? pHits.map((h, i) => `<div class="r${i === pSel ? " sel" : ""}" data-i="${i}"><div class="ttl">${escapeHtml(h.title)}</div><div class="where">${escapeHtml(h.relPath)} › ${escapeHtml(h.heading)}</div><div class="snip">${hl(h.snippet, q)}</div></div>`).join("") : `<div class="empty">没有结果</div>`;
    pRes.querySelectorAll(".r").forEach((r) => r.addEventListener("click", () => goHit(pHits[Number(r.dataset.i)])));
  }
  function goHit(h) { if (!h) return; if (pMode === "insert" && editor?.insertLink) { editor.insertLink(h); closePalette(); return; } closePalette(); location.hash = `#/${h.relPath}#${slug(h.heading)}`; }
  pInput.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); pSel = Math.min(pHits.length - 1, pSel + 1); renderPalette(pInput.value.trim()); }
    else if (e.key === "ArrowUp") { e.preventDefault(); pSel = Math.max(0, pSel - 1); renderPalette(pInput.value.trim()); }
    else if (e.key === "Enter") { e.preventDefault(); if (pHits.length) goHit(pHits[pSel]); else if (pInput.value.trim() && pMode !== "insert") { closePalette(); location.hash = "#/search=" + encodeURIComponent(pInput.value.trim()); } }
    else if (e.key === "Escape") closePalette();
  });

  // ---------- 路由 ----------
  const hashPath = () => location.hash.replace(/^#\/?/, "");
  let lastHash = location.hash;
  function route() {
    // 离开编辑器前确认（替换地址不会再次触发 hashchange；注意本文件的 history 变量是聊天记录）
    if (editor?.dirty && location.hash !== lastHash && !confirm("有未保存的修改，确定离开编辑器？")) { window.history.replaceState(null, "", lastHash); return; }
    lastHash = location.hash;
    if (editor) closeEditor();
    const h = hashPath();
    if (!h) return showHome();
    if (h.startsWith("search=")) return showSearch(decodeURIComponent(h.slice(7)));
    if (h === "browse" || h.startsWith("browse?")) return showBrowse(h.slice(7));
    if (!STATIC && (h === "new" || h.startsWith("new?"))) { const q = new URLSearchParams(h.slice(4)); return showEditor({ dir: q.get("dir") || "", prefill: q.get("prefill") === "1" }); }
    if (!STATIC && h.startsWith("edit/")) return showEditor({ path: decodeURIComponent(h.slice(5).split("#")[0]) });
    const [p, hash] = h.split("#");
    showDoc(decodeURIComponent(p), hash);
  }
  window.addEventListener("hashchange", route);

  // ---------- 笔记编辑器（本机版）：#/new?dir=… 新建，#/edit/<path> 修改；保存 → 服务端重建索引 + 静态站 ----------
  const canEdit = (p) => p.endsWith(".md") && p !== "STANDARD.md" && !p.startsWith("templates/");
  const toastEl = $("#toast");
  let toastTimer = null;
  function toast(text, ms = 3200) {
    toastEl.textContent = text; toastEl.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => (toastEl.hidden = true), ms);
  }
  const splitFrontmatter = (text) => { const m = text.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/); return m ? { fm: m[0], body: text.slice(m[0].length) } : { fm: "", body: text }; };
  /** 下一个章节号：文件夹里已有的最大 NN + 1 */
  function nextNumber(dir) {
    const nums = flatFiles.filter((f) => f.path.startsWith(dir + "/") && !f.path.slice(dir.length + 1).includes("/")).map((f) => Number((f.name.match(/^(\d{2})-/) || [])[1])).filter((n) => !Number.isNaN(n));
    return String(Math.max(0, ...nums) + 1).padStart(2, "0");
  }
  const siblingTopic = (dir) => flatFiles.find((f) => f.path.startsWith(dir + "/") && f.topic)?.topic ?? "";
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const relLink = (fromDir, to) => { const a = fromDir ? fromDir.split("/") : [], b = to.split("/"); let i = 0; while (i < a.length && i < b.length - 1 && a[i] === b[i]) i++; return [...a.slice(i).map(() => ".."), ...b.slice(i)].join("/"); };
  let rules = null; // STANDARD 硬规则，来自 /api/rules（与检查器同源）
  /** 编辑器里的实时规范检查：和服务端 kb.check() 同一套规则，省一次"保存才知道错"的往返 */
  function lintDraft(text, targetPath, isNew) {
    const out = [];
    if (!rules) return out;
    const fmm = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
    if (!fmm) return ["第一行必须是 --- 开头的 frontmatter"];
    const meta = {};
    for (const line of fmm[1].split(/\r?\n/)) { const m = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/); if (m) meta[m[1]] = m[2].replace(/\s+#.*$/, "").trim(); else if (/^\s+-\s+\S/.test(line) && out.lastKey) meta[out.lastKey] = (meta[out.lastKey] || "") + " -"; }
    for (const f of rules.fields) if (meta[f] == null || meta[f] === "" || meta[f] === "[]") out.push(`frontmatter 缺少 ${f}`);
    const base = targetPath.slice(targetPath.lastIndexOf("/") + 1);
    if (isNew && base && !/^\d{2}-$/.test(base) && !new RegExp(rules.fileName).test(base)) out.push("文件名必须是 两位数字-小写英文短横线.md"); // 还只有 NN- 前缀时先不催
    const body = text.slice(fmm[0].length);
    const prose = body.replace(/^\s*```[\s\S]*?^\s*```\s*$/gm, "").replace(/`[^`\n]*`/g, "");
    if (!/^#\s+\S/m.test(prose)) out.push("缺少 H1 标题（# 开头）");
    const heads = [...prose.matchAll(/^##\s+(.+?)\s*$/gm)].map((m) => m[1].trim());
    const need = rules.sections[meta.type] ?? [];
    const missing = need.filter((h) => !heads.includes(h));
    for (const h of missing) out.push(`缺少固定段落 ## ${h}`);
    if (!missing.length && need.length) { const seq = heads.filter((h) => need.includes(h)); if (seq.join("|") !== need.join("|")) out.push("固定段落的顺序和 STANDARD 不一致"); }
    let inFence = false;
    body.split("\n").forEach((line, i) => { if (!/^\s*```/.test(line)) return; if (!inFence && /^\s*```\s*$/.test(line)) out.push(`代码块未标语言（第 ${i + 1 + fmm[0].split("\n").length - 1} 行）`); inFence = !inFence; });
    const dir = targetPath.slice(0, targetPath.lastIndexOf("/"));
    const known = new Set(flatFiles.map((f) => f.path)); known.add(targetPath);
    for (const m of prose.matchAll(/\]\(([^)\s#]+\.md)(#[^)]*)?\)/g)) { const t = m[1]; if (/^https?:/.test(t)) continue; const abs = resolveRel(dir ? dir + "/x" : "x", t); if (!known.has(abs)) out.push(`链接目标不存在: ${t}`); }
    if (meta.type === "paper-note") {
      if (!/^related:\s*(\[.*\S.*\]|\S)|^related:\s*$\n\s+-\s+\S/m.test(fmm[1])) out.push("论文笔记必须有 related（关联的知识章节）");
      const sum = body.match(/^## 一句话总结\s*\n([\s\S]*?)(?=^## )/m)?.[1].replace(/\s+/g, "") ?? "";
      if (sum.length > rules.summaryMax) out.push(`一句话总结 ${sum.length} 字，超过 ${rules.summaryMax} 字`);
    }
    return out;
  }
  const SNIPPETS = [
    ["💡 要点", "> 💡 要点："], ["⚠️ 注意", "> ⚠️ 注意："], ["🔍 深入", "> 🔍 深入："], ["🔗 关联", "> 🔗 关联："], ["❓ 待解决", "> ❓ 待解决："],
    ["代码块", "```bash\n\n```"], ["表格", "| 列 1 | 列 2 | 列 3 |\n|---|---|---|\n| | | |"], ["折叠答案", "<details><summary>答案</summary>\n\n</details>"], ["公式", "$$\n\n$$"], ["Mermaid", "```mermaid\nflowchart LR\n  A[输入] --> B[输出]\n```"],
  ];
  const draftKey = (path, dir) => `draft:${path ?? "new:" + dir}`;
  async function showEditor({ path, dir, prefill }) {
    currentPath = ""; tocEl.innerHTML = ""; highlightActive();
    const isEdit = Boolean(path);
    let raw = null, templates = [], dirs = [];
    try {
      [dirs, templates, raw, rules] = await Promise.all([getJSON("/api/dirs"), isEdit ? [] : getJSON("/api/templates"), isEdit ? getJSON(`/api/raw?path=${encodeURIComponent(path)}`) : null, rules ?? getJSON("/api/rules")]);
    } catch (err) { contentEl.innerHTML = `<div class="doc-head"><h1>无法打开编辑器</h1></div><p>${escapeHtml(err.message)}</p>`; return; }
    if (isEdit && raw && !raw.editable) { contentEl.innerHTML = `<div class="doc-head"><h1>这篇文档不能在网页里修改</h1></div><p>${escapeHtml(path)}</p>`; return; }
    const startDir = isEdit ? path.slice(0, path.lastIndexOf("/")) : dir || (lastDoc()?.path ? lastDoc().path.slice(0, lastDoc().path.lastIndexOf("/")) : "notes");
    const canRegister = !isEdit && !startDir.startsWith("Knowledge/Papers/") && startDir !== "notes";
    contentEl.innerHTML = `<div class="doc-head editor-head"><h1>${isEdit ? "✎ 编辑文档" : "✎ 新建笔记"}</h1>
        <p class="editor-help">保存后本机服务会自动：重建索引 → 刷新论文库目录 → 重新生成静态站，并刷新所有打开的页面。右下角实时对照 <a href="#/STANDARD.md">STANDARD.md</a> 检查；草稿会自动暂存在浏览器里。</p></div>
      <div class="editor">
        <div class="editor-top"><div class="editor-bar">
          <label>文件夹<input id="edDir" class="ed-dir" list="edDirs" value="${escapeHtml(startDir)}" ${isEdit ? "readonly" : ""} /><datalist id="edDirs">${dirs.map((d) => `<option value="${escapeHtml(d)}">`).join("")}</datalist></label>
          <label>文件名<input id="edName" class="ed-name" placeholder="03-my-note.md" value="${escapeHtml(isEdit ? path.slice(path.lastIndexOf("/") + 1) : "")}" ${isEdit ? "readonly" : ""} /></label>
          ${isEdit ? "" : `<label>模板<select id="edTpl">${templates.map((t) => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.label)}</option>`).join("")}</select></label>`}
          <span class="spacer"></span>
          <label class="check" ${canRegister ? "" : "hidden"} title="保存后按 frontmatter 在所在文件夹的 00-README.md 章节表里加一行"><input type="checkbox" id="edRegister" checked /> 登记到目录</label>
          <label class="check"><input type="checkbox" id="edPreviewOn" checked /> 预览</label>
          <a class="btn" href="${isEdit ? "#/" + path : "#/"}">取消</a>
          <button type="button" class="btn primary" id="edSave">保存 <kbd>⌘S</kbd></button>
        </div>
        <div class="ed-tools" role="toolbar" aria-label="插入">${SNIPPETS.map(([l], i) => `<button type="button" class="tool" data-i="${i}">${escapeHtml(l)}</button>`).join("")}<button type="button" class="tool" id="edLink" title="搜索知识库并插入相对链接">🔎 插入章节链接</button></div></div>
        <div id="edDraft" class="draft-bar" hidden></div>
        <div class="editor-panes" id="edPanes"><textarea id="edText" spellcheck="false" placeholder="第一行必须是 --- 开头的 frontmatter"></textarea><div class="editor-right"><div id="edLint" class="editor-lint"></div><div id="edPreview" class="content editor-preview"></div></div></div>
        <div id="edStatus" class="editor-status" hidden></div>
      </div>`;
    const edDir = $("#edDir"), edName = $("#edName"), edTpl = $("#edTpl"), edText = $("#edText"), edPreview = $("#edPreview"), edStatus = $("#edStatus"), edLint = $("#edLint");
    editor = { path: isEdit ? path : null, dirty: false, fresh: "", isEdit };
    const status = (html, cls) => { edStatus.hidden = false; edStatus.className = `editor-status ${cls ?? ""}`; edStatus.innerHTML = html; };
    const targetPath = () => editor.path ?? `${edDir.value.trim().replace(/\/+$/, "")}/${edName.value.trim()}`;
    let previewTimer = null, draftTimer = null;
    const renderLint = () => {
      const problems = lintDraft(edText.value, targetPath(), !editor.path);
      edLint.className = `editor-lint ${problems.length ? "bad" : "good"}`;
      edLint.innerHTML = problems.length ? `<b>规范检查：${problems.length} 个问题</b><ul>${problems.map((p) => `<li>${escapeHtml(p)}</li>`).join("")}</ul>` : `<b>✓ 符合 STANDARD.md</b>`;
    };
    const renderPreview = () => {
      renderLint();
      if (!$("#edPreviewOn").checked) return;
      const { body } = splitFrontmatter(edText.value);
      const h1 = body.match(/^#\s+(.+)$/m);
      edPreview.innerHTML = (h1 ? `<h1 class="preview-title">${renderInline(h1[1])}</h1>` : "") + renderMarkdown(h1 ? body.replace(h1[0], "") : body, targetPath());
      postProcess(edPreview);
    };
    const schedulePreview = () => { clearTimeout(previewTimer); previewTimer = setTimeout(renderPreview, 250); };
    // 草稿自动暂存：刷新、误点链接、服务重启都不丢
    const saveDraft = () => { clearTimeout(draftTimer); draftTimer = setTimeout(() => { if (editor?.dirty) store.set(draftKey(editor.path, edDir.value.trim()), JSON.stringify({ content: edText.value, name: edName.value, at: Date.now() })); }, 400); };
    const clearDraft = () => { try { localStorage.removeItem(draftKey(editor.path, edDir.value.trim())); } catch {} };
    const offerDraft = () => {
      let d = null; try { d = JSON.parse(store.get(draftKey(editor.path, edDir.value.trim())) || "null"); } catch {}
      if (!d || d.content === edText.value) return;
      const bar = $("#edDraft"); bar.hidden = false;
      bar.innerHTML = `📝 发现 ${Math.max(1, Math.round((Date.now() - d.at) / 60000))} 分钟前未保存的草稿${d.name ? `（${escapeHtml(d.name)}）` : ""}。<button type="button" class="btn small primary" id="edRestore">恢复</button><button type="button" class="btn small" id="edDiscard">丢弃</button>`;
      $("#edRestore").addEventListener("click", () => { edText.value = d.content; if (d.name && !editor.path) edName.value = d.name; editor.dirty = true; bar.hidden = true; renderPreview(); });
      $("#edDiscard").addEventListener("click", () => { clearDraft(); bar.hidden = true; });
    };
    // 在光标处插入片段（选中文字时放进片段的空行里）
    const insert = (snippet) => {
      const s0 = edText.selectionStart, e0 = edText.selectionEnd, sel = edText.value.slice(s0, e0);
      const text = sel && snippet.includes("\n\n") ? snippet.replace("\n\n", `\n${sel}\n`) : snippet.endsWith("：") ? snippet + sel : snippet;
      const before = edText.value.slice(0, s0);
      const pad = before && !before.endsWith("\n") && snippet.startsWith("|") ? "\n" : before && !before.endsWith("\n") && (snippet.startsWith(">") || snippet.startsWith("`") || snippet.startsWith("<") || snippet.startsWith("$")) ? "\n\n" : "";
      edText.setRangeText(pad + text, s0, e0, "end");
      const caret = snippet.includes("\n\n") && !sel ? s0 + pad.length + snippet.indexOf("\n\n") + 1 : edText.selectionEnd;
      edText.setSelectionRange(caret, caret); edText.focus();
      editor.dirty = true; schedulePreview(); saveDraft();
    };
    document.querySelectorAll(".ed-tools .tool[data-i]").forEach((b) => b.addEventListener("click", () => insert(SNIPPETS[Number(b.dataset.i)][1])));
    $("#edLink").addEventListener("click", () => openPalette("insert"));
    editor.insertLink = (hit) => { const t = targetPath(); insert(`[${hit.title}](${relLink(t.slice(0, t.lastIndexOf("/")), hit.relPath)})`); };
    // 编辑器 ↔ 预览按比例同步滚动
    edText.addEventListener("scroll", () => { if (!$("#edPreviewOn").checked) return; const r = edText.scrollTop / Math.max(1, edText.scrollHeight - edText.clientHeight); edPreview.scrollTop = r * (edPreview.scrollHeight - edPreview.clientHeight); });
    // 新建：按文件夹填默认值（章节号、topic），内容还是"未改动的模板"时跟着换
    const applyTemplate = () => {
      const t = templates.find((x) => x.id === edTpl.value) ?? templates[0];
      if (!t) return;
      const d = edDir.value.trim().replace(/\/+$/, "");
      const n = nextNumber(d), topic = siblingTopic(d);
      let text = t.content.replace(/^chapter:\s*\d+/m, `chapter: ${Number(n)}`);
      if (topic) text = text.replace(/^topic:\s*\S+(.*)$/m, `topic: ${topic}$1`);
      edText.value = editor.fresh = text; editor.dirty = false;
      if (!edName.value.trim() || /^\d{2}-$/.test(edName.value.trim())) edName.value = `${n}-`;
      renderPreview();
    };
    if (isEdit) { edText.value = editor.fresh = raw.content; renderPreview(); }
    else {
      applyTemplate();
      edTpl.addEventListener("change", () => { if (editor.dirty && !confirm("切换模板会清空当前内容，继续？")) { return; } applyTemplate(); });
      edDir.addEventListener("change", () => { if (!editor.dirty) applyTemplate(); else if (/^\d{2}-$/.test(edName.value.trim())) edName.value = `${nextNumber(edDir.value.trim())}-`; $("#edRegister")?.closest("label")?.toggleAttribute("hidden", edDir.value.trim().startsWith("Knowledge/Papers/") || edDir.value.trim() === "notes"); });
      // 从助教回答"存为笔记"带过来的内容
      if (prefill) {
        let pf = null; try { pf = JSON.parse(sessionStorage.getItem("kbPrefill") || "null"); sessionStorage.removeItem("kbPrefill"); } catch {}
        if (pf) {
          const t = templates.find((x) => x.id === "note") ?? templates[0];
          let text = t.content.replace(/^title: .*$/m, `title: ${pf.title}`).replace(/^# .*$/m, `# ${pf.title}`);
          text = text.replace(/## 详细记录\n/, `## 详细记录\n\n${pf.body.trim()}\n`);
          edText.value = text; editor.fresh = ""; editor.dirty = true; renderPreview();
        }
      }
    }
    offerDraft();
    edText.addEventListener("input", () => { editor.dirty = edText.value !== editor.fresh; schedulePreview(); saveDraft(); });
    edText.addEventListener("keydown", (e) => { if (e.key === "Tab") { e.preventDefault(); const s0 = edText.selectionStart, e0 = edText.selectionEnd; edText.setRangeText("  ", s0, e0, "end"); editor.dirty = true; schedulePreview(); } });
    $("#edPreviewOn").addEventListener("change", (e) => { $("#edPanes").classList.toggle("no-preview", !e.target.checked); renderPreview(); });
    $("#edSave").addEventListener("click", saveEditor);
    editor.save = saveEditor;
    async function saveEditor() {
      const relPath = targetPath();
      if (!editor.path && (!edName.value.trim() || !edDir.value.trim())) return status("⚠️ 请填写文件夹和文件名", "err");
      if (editor.saving) return;
      // 改了已有文档就把 updated 改成今天（STANDARD 第 9 节）
      let content = edText.value;
      let bumped = false;
      if (editor.isEdit && content !== editor.fresh) { const next = content.replace(/^updated:\s*\S+/m, `updated: ${today()}`); bumped = next !== content; if (bumped) { content = next; edText.value = content; } }
      editor.saving = true; $("#edSave").disabled = true;
      status("保存中…");
      let j;
      try {
        const res = await fetch("/api/note", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path: relPath, content, overwrite: Boolean(editor.path), register: Boolean($("#edRegister")?.checked && !$("#edRegister").closest("label").hidden) }) });
        j = await res.json();
        if (!res.ok) return status(`⚠️ ${escapeHtml(j.error || res.statusText)}`, "err");
      } catch (err) { return status(`⚠️ 保存失败：${escapeHtml(err.message)}`, "err"); }
      finally { editor.saving = false; $("#edSave").disabled = false; }
      clearDraft();
      editor.dirty = false; editor.fresh = edText.value;
      if (!editor.path) { editor.path = j.relPath; editor.isEdit = true; edDir.readOnly = edName.readOnly = true; edTpl?.closest("label")?.remove(); $("#edRegister")?.closest("label")?.remove(); }
      const dir = j.relPath.slice(0, j.relPath.lastIndexOf("/"));
      const lines = [`✅ 已保存 <code>${escapeHtml(j.relPath)}</code>`, `索引已重建（${j.stats.documents} 篇文档）`];
      if (bumped) lines.push(`updated 已改为 ${today()}`);
      if (j.indexes?.length) lines.push(`论文库目录已刷新：${j.indexes.map(escapeHtml).join("、")}`);
      if (j.build) lines.push(j.build.ok ? `静态站已重新生成（${j.build.ms} ms）` : `⚠️ 静态站构建失败：${escapeHtml(j.build.message)}`);
      else lines.push("静态站自动构建已关闭（KB_AUTO_BUILD=0）");
      await loadTree();
      const readme = flatFiles.find((f) => f.path === `${dir}/00-README.md`);
      const r = j.registered;
      let remind = "";
      if (r?.status === "added") lines.push(`已登记到 <a href="#/${r.readme}">${escapeHtml(r.readme)}</a>：<code>${escapeHtml(r.row)}</code>`);
      else if (r && r.status !== "auto" && r.status !== "skip" && r.status !== "exists") remind = `<div class="muted">没能自动登记（${escapeHtml(r.error || r.status)}）：<a href="#/edit/${r.readme}">编辑 ${escapeHtml(r.readme)}</a> 的章节表加一行。</div>`;
      else if (!r && j.created && !j.relPath.endsWith("00-README.md") && readme && !dir.startsWith("Knowledge/Papers/")) remind = `<div class="muted">新章节还没在目录里登记：<button type="button" class="btn small" id="edRegisterNow">📌 登记到 ${escapeHtml(readme.path)}</button></div>`;
      const problems = j.problems ?? [];
      status(`${lines.join(" · ")}${problems.length ? `<div>⚠️ 规范检查有 ${problems.length} 个问题（已保存，建议修正后再保存一次）：</div><ul>${problems.map((p) => `<li>${escapeHtml(p)}</li>`).join("")}</ul>` : ""}${remind}<div><a href="#/${j.relPath}">查看文档 →</a></div>`, problems.length ? "err" : "ok");
      $("#edRegisterNow")?.addEventListener("click", async (e) => {
        e.target.disabled = true;
        try { const rr = await (await fetch("/api/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path: j.relPath }) })).json(); e.target.replaceWith(Object.assign(document.createElement("span"), { textContent: rr.status === "added" ? `✅ 已登记：${rr.row}` : `（${rr.error || rr.status}）` })); await loadTree(); } catch (err) { e.target.textContent = `登记失败：${err.message}`; }
      });
      if (!problems.length && !remind) setTimeout(() => { if (editor && !editor.dirty) { location.hash = "#/" + j.relPath; toast(`✅ 已保存${r?.status === "added" ? "并登记到 00-README" : ""} · 索引与静态站已重建`); } }, 900);
    }
    document.title = `${isEdit ? "编辑" : "新建笔记"} · Learning 知识库`;
    mainEl.scrollTo(0, 0);
    if (isMobile()) layout.classList.remove("nav-open");
    setTimeout(() => edText.focus(), 0);
  }
  function closeEditor() { editor = null; }
  window.addEventListener("beforeunload", (e) => { if (editor?.dirty) { e.preventDefault(); e.returnValue = ""; } });
  $("#newNoteBtn").addEventListener("click", (e) => {
    // 从文档页点"新建"时默认放进同一个文件夹
    if (currentPath && currentPath.includes("/")) { e.preventDefault(); location.hash = `#/new?dir=${encodeURIComponent(currentPath.slice(0, currentPath.lastIndexOf("/")))}`; }
  });
  /** 订阅服务端的变化事件：别处保存 / 磁盘上改了文件 / 静态站重建 → 刷新目录与当前文档 */
  function subscribeChanges() {
    if (!("EventSource" in window)) return;
    const es = new EventSource("/api/events");
    es.onmessage = (e) => {
      let ev; try { ev = JSON.parse(e.data); } catch { return; }
      if (ev.type === "kb-changed") {
        loadTree().then(() => { if (!editor && currentPath && (!ev.file || ev.file === currentPath)) route(); }).catch(() => {});
        if (ev.reason === "watch") toast(`📝 ${ev.file} 已更新，目录已刷新`);
      } else if (ev.type === "built" && ev.reason === "watch") toast(ev.ok ? `🏗️ 静态站已重新生成（${ev.ms} ms）` : "⚠️ 静态站构建失败，看终端日志");
    };
  }

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
    if (done && !STATIC && text.trim() && !div.querySelector(".msg-actions")) {
      // 把这条回答一键变成 notes/ 下的笔记（带来源问题），进编辑器再改
      const bar = document.createElement("div"); bar.className = "msg-actions";
      const b = document.createElement("button"); b.type = "button"; b.className = "btn small ghost"; b.textContent = "✎ 存为笔记";
      b.addEventListener("click", () => {
        const q = (div.previousElementSibling?.classList.contains("user") ? div.previousElementSibling.querySelector(".bubble").textContent : "").trim();
        const title = (q.split("\n")[0] || "助教回答").replace(/[#*`[\]]/g, "").slice(0, 40);
        try { sessionStorage.setItem("kbPrefill", JSON.stringify({ title, body: (q ? `> 来源问题：${q.replace(/\n+/g, " ")}\n\n` : "") + text })); } catch {}
        setChat(false); location.hash = "#/new?dir=notes&prefill=1";
      });
      bar.appendChild(b); div.querySelector(".bubble").appendChild(bar);
    }
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
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s" && editor) { e.preventDefault(); editor.save?.(); return; }
    if (e.key === "Escape") { closePalette(); layout.classList.remove("nav-open"); if (document.activeElement === input) setChat(false); return; }
    if (typing) return;
    if (e.key === "/") { e.preventDefault(); openPalette(); }
    else if (e.key === "[") layout.classList.toggle(isMobile() ? "nav-open" : "nav-hidden");
    else if (e.key === "]") STATIC ? window.open(LOCAL_URL + location.hash, "_blank") : setChat(!document.body.classList.contains("chat-open"));
    else if (e.key === "e" && !STATIC && currentPath && canEdit(currentPath)) location.hash = "#/edit/" + currentPath;
    else if (e.key === "n" && !STATIC) location.hash = currentPath.includes("/") ? `#/new?dir=${encodeURIComponent(currentPath.slice(0, currentPath.lastIndexOf("/")))}` : "#/new";
    else if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && currentPath) {
      const sib = siblings(currentPath); const i = sib.findIndex((f) => f.path === currentPath); const t = sib[e.key === "ArrowLeft" ? i - 1 : i + 1]; if (t) location.hash = "#/" + t.path;
    }
  });
  $("#navBackdrop").addEventListener("click", () => layout.classList.remove("nav-open"));

  if (STATIC) {
    // 公网静态站没有后端：隐藏导入，助教按钮跳到本机版（Mac 上开机自启的 http://localhost:8787）
    $("#importBtn").hidden = true;
    $("#newNoteBtn").hidden = true;
    const btn = $("#toggleChat"); btn.textContent = "💬 助教（本机）"; btn.title = "AI 助教只在你电脑上的本机版可用";
    btn.replaceWith(btn.cloneNode(true));
    $("#toggleChat").addEventListener("click", () => window.open(LOCAL_URL + location.hash, "_blank"));
  } else {
    fetch("/api/health").then((r) => r.json()).then((h) => { $("#chatModel").textContent = h.model; }).catch(() => {});
    subscribeChanges();
  }
  loadTree().then(route).catch((err) => { $("#stats").textContent = "目录加载失败：" + err.message; contentEl.innerHTML = `<div class="doc-head"><h1>目录加载失败</h1></div><p>${escapeHtml(err.message)}</p><p>请确认服务已启动（终端里 ./start.sh），然后刷新。</p>`; });
})();
