// Central configuration. Everything can be overridden with environment variables.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

/** Root of the knowledge base = the `Learning` folder (parent of `agent/`). */
export const KB_ROOT = path.resolve(process.env.KB_ROOT ?? path.join(here, "..", ".."));

/** Folders (relative to KB_ROOT) that are never indexed or written to. */
export const EXCLUDED_DIRS = new Set(["agent", "node_modules", "dist", ".git", ".obsidian", ".vscode"]);

/** Files that are instructions for tools, not knowledge content (never indexed). */
export const EXCLUDED_FILES = new Set(["CLAUDE.md", "AGENTS.md", "CONTRIBUTING.md", "CHANGELOG.md"]);

/** Folder where the agent sediments Q&A and auto-generated notes. */
export const NOTES_DIR = "notes";

/** Research-paper library (STANDARD.md 第 11 节). Every paper note lives in a domain sub-folder. */
export const PAPERS_DIR = "Knowledge/Papers";

/** Domain folder -> the topic its paper notes must use, plus topics that count as that domain. */
export const PAPER_DOMAINS = {
  VLA: { topic: "vla", label: "VLA 视觉-语言-动作模型", topics: ["vla", "forcevla"] },
  WAM: { topic: "wam", label: "WAM 世界模型", topics: ["wam"] },
  Robotics: { topic: "robotics", label: "通用机器人学习", topics: ["robotics", "ur", "paper"] },
};

export const PORT = Number(process.env.PORT ?? 8787);

/**
 * "保存即重建"：网页里保存笔记（或任何 .md 变化）后，本机服务重建索引、刷新论文库目录，并把 GitHub Pages
 * 同款静态站重新生成到 KB_DIST（默认 <知识库>/dist，已 gitignore）。KB_AUTO_BUILD=0 只重建索引、不生成静态站。
 */
export const DIST_DIR = path.resolve(process.env.KB_DIST ?? path.join(KB_ROOT, "dist"));
export const AUTO_BUILD = process.env.KB_AUTO_BUILD !== "0";

/**
 * Which credential the SDK will use, in its own precedence order: env API key, env auth token,
 * then the OAuth profile written by `ant auth login`. null = chat / paper import will fail.
 */
export function credentialSource() {
  if (process.env.ANTHROPIC_API_KEY) return "api-key";
  if (process.env.ANTHROPIC_AUTH_TOKEN) return "auth-token";
  if (process.env.ANTHROPIC_PROFILE) return "profile";
  const dir = path.join(process.env.ANTHROPIC_CONFIG_DIR ?? path.join(os.homedir(), ".config", "anthropic"), "credentials");
  try {
    if (fs.readdirSync(dir).some((f) => f.endsWith(".json"))) return "profile";
  } catch {}
  return null;
}

/** Today as YYYY-MM-DD in local time (frontmatter dates; toISOString would be UTC and off by a day in UTC+8 mornings). */
export const localDate = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * Where chat / paper import get Claude from:
 *   claude-code (default) — the local `claude` CLI in headless mode, billed to the Claude Pro / Max plan it is logged into
 *   api                   — @anthropic-ai/sdk with an API key or `ant auth login` profile, billed as API usage
 */
export const BACKEND = process.env.KB_BACKEND === "api" ? "api" : "claude-code";

/** Model for the claude-code backend: an alias (opus / sonnet / fable) or a full model ID. */
export const CC_MODEL = process.env.KB_CC_MODEL ?? "opus";

/** Default model for the api backend. Override with KB_MODEL=claude-sonnet-5-5 etc. */
export const MODEL = process.env.KB_MODEL ?? "claude-opus-5-5";

/** Effort for chat / paper notes (low | medium | high | xhigh | max). */
export const CHAT_EFFORT = process.env.KB_CHAT_EFFORT ?? "medium";
export const PAPER_EFFORT = process.env.KB_PAPER_EFFORT ?? "high";

/** Server-side refusal fallbacks (Claude API only). Set KB_FALLBACKS=0 to disable. */
export const USE_FALLBACKS = process.env.KB_FALLBACKS !== "0";

/** Max agentic tool-use rounds per chat turn. */
export const MAX_TOOL_ROUNDS = Number(process.env.KB_MAX_TOOL_ROUNDS ?? 12);

/** Max characters of a document returned to the model by read_document. */
export const MAX_DOC_CHARS = Number(process.env.KB_MAX_DOC_CHARS ?? 40_000);
