// The claude-code backend: argument building and stream-json parsing (no real `claude` process is started).
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildArgs, parseStreamLine } from "../src/claude-code.js";

test("headless args: subscription-safe, nothing allowed beyond the given rules", () => {
  const args = buildArgs({ tools: ["Read", "Edit"], allow: ["Read", "Edit(./notes/**)"], system: "S", effort: "medium" });
  const after = (flag) => args[args.indexOf(flag) + 1];
  assert.ok(args.includes("-p") && !args.includes("--bare"), "--bare 不读订阅登录，不能用");
  assert.equal(after("--permission-mode"), "dontAsk");
  assert.equal(after("--permission-prompts"), "none");
  assert.equal(after("--output-format"), "stream-json");
  assert.equal(after("--tools"), "Read,Edit");
  assert.deepEqual(args.slice(args.indexOf("--allowedTools") + 1, args.indexOf("--disallowedTools")), ["Read", "Edit(./notes/**)"]);
  assert.ok(args.includes("Read(./agent/.env)"), "不能读 .env");
  assert.ok(!args.some((a) => /^Write\(/.test(a)), "Write(path) 规则不生效，路径限制必须用 Edit(path)");
  assert.equal(after("--append-system-prompt"), "S");
});

const line = (o) => JSON.stringify(o);

test("stream-json: text deltas, tool calls, tool results, final result", () => {
  assert.deepEqual(parseStreamLine(line({ type: "stream_event", parent_tool_use_id: null, event: { type: "content_block_delta", delta: { type: "text_delta", text: "你好" } } })), [{ type: "text", text: "你好" }]);
  assert.deepEqual(parseStreamLine(line({ type: "stream_event", event: { type: "content_block_delta", delta: { type: "input_json_delta", partial_json: "{" } } })), []);
  assert.deepEqual(parseStreamLine(line({ type: "assistant", parent_tool_use_id: null, message: { content: [{ type: "text", text: "x" }, { type: "tool_use", name: "Read", input: { file_path: "a.md" } }] } })), [{ type: "tool_call", name: "Read", input: { file_path: "a.md" } }]);
  assert.equal(parseStreamLine(line({ type: "user", message: { content: [{ type: "tool_result", is_error: true, content: [{ type: "text", text: "denied" }] }] } }))[0].preview, "错误：denied");
  assert.deepEqual(parseStreamLine(line({ type: "result", subtype: "success", is_error: false, result: "完成" })), [{ type: "result", isError: false, text: "完成", subtype: "success" }]);
  assert.deepEqual(parseStreamLine(line({ type: "system", subtype: "init" })), []);
  assert.deepEqual(parseStreamLine("not json"), []);
});

test("subagent output (parent_tool_use_id set) is not mixed into the answer", () => {
  assert.deepEqual(parseStreamLine(line({ type: "stream_event", parent_tool_use_id: "toolu_1", event: { type: "content_block_delta", delta: { type: "text_delta", text: "inner" } } })), []);
});
