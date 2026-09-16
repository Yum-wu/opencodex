import { describe, expect, test } from "bun:test";
import { nativeChatSse } from "../../src/server/chat-native-sse";
import { createTranslatorBudget } from "../../src/lib/translator-budget";

describe("nativeChatSse lenient EOF termination", () => {
  const encoder = new TextEncoder();

  function makeBudget() {
    return createTranslatorBudget({ maxResidentBytes: 1024 * 1024, maxLiveTransientBytes: 1024 * 1024 });
  }

  test("text-only stream without terminal event recovers gracefully with [DONE] and 200", async () => {
    const budget = makeBudget();
    const abort = new AbortController();
    let source!: ReadableStreamDefaultController<Uint8Array>;
    const body = new ReadableStream<Uint8Array>({ start(c) { source = c; } });
    let terminalStatus = 0;

    const stream = nativeChatSse(body, {
      requestedModel: "mock/test-model",
      translatorBudget: budget,
      signal: abort.signal,
      stallTimeoutSec: 1,
      onUsage() {},
      onTerminal(status) { terminalStatus = status; },
    });

    const outputPromise = new Response(stream).text();
    source.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"Partial text output"崩\n\n'.replace('崩', '}}]}')));
    source.close();

    const result = await outputPromise;
    budget.dispose();

    expect(result).toContain("Partial text output");
    expect(result).toContain("data: [DONE]");
    expect(result).not.toContain("upstream_sse_truncated");
    expect(terminalStatus).toBe(200);
  });

  test("tool-call stream without terminal event fails closed with upstream_sse_truncated", async () => {
    const budget = makeBudget();
    const abort = new AbortController();
    let source!: ReadableStreamDefaultController<Uint8Array>;
    const body = new ReadableStream<Uint8Array>({ start(c) { source = c; } });
    let terminalStatus = 0;

    const stream = nativeChatSse(body, {
      requestedModel: "mock/test-model",
      translatorBudget: budget,
      signal: abort.signal,
      stallTimeoutSec: 1,
      onUsage() {},
      onTerminal(status) { terminalStatus = status; },
    });

    const outputPromise = new Response(stream).text();
    const toolPayload = JSON.stringify({
      choices: [{ delta: { tool_calls: [{ id: "call_1", function: { name: "search", arguments: '{"q":' } }] } }],
    });
    source.enqueue(encoder.encode(`data: ${toolPayload}\n\n`));
    source.close();

    const result = await outputPromise;
    budget.dispose();

    expect(result).toContain("upstream_sse_truncated");
    expect(terminalStatus).toBe(502);
  });

  test("zero-output stream without terminal event fails closed with upstream_sse_truncated", async () => {
    const budget = makeBudget();
    const abort = new AbortController();
    let source!: ReadableStreamDefaultController<Uint8Array>;
    const body = new ReadableStream<Uint8Array>({ start(c) { source = c; } });
    let terminalStatus = 0;

    const stream = nativeChatSse(body, {
      requestedModel: "mock/test-model",
      translatorBudget: budget,
      signal: abort.signal,
      stallTimeoutSec: 1,
      onUsage() {},
      onTerminal(status) { terminalStatus = status; },
    });

    const outputPromise = new Response(stream).text();
    source.close();

    const result = await outputPromise;
    budget.dispose();

    expect(result).toContain("upstream_sse_truncated");
    expect(terminalStatus).toBe(502);
  });
});