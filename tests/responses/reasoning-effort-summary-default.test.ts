import { describe, expect, test } from "bun:test";
import { parseRequest } from "../../src/responses/parser";
import { concreteComboRequestBody } from "../../src/combos/request";
import type { OcxComboTarget } from "../../src/types";

describe("reasoning effort preserves visible thinking when summary is omitted", () => {
  test("reasoning with active effort does not default to hideThinkingSummary", () => {
    const parsed = parseRequest({
      model: "test-model",
      reasoning: { effort: "high" },
      input: [{ type: "message", role: "user", content: [{ type: "input_text", text: "hi" }] }],
    });
    expect(parsed.options.reasoning).toBe("high");
    expect(parsed.options.hideThinkingSummary).toBeUndefined();
  });

  test("explicit summary of none still hides thinking summary", () => {
    const parsed = parseRequest({
      model: "test-model",
      reasoning: { effort: "high", summary: "none" },
      input: [{ type: "message", role: "user", content: [{ type: "input_text", text: "hi" }] }],
    });
    expect(parsed.options.reasoning).toBe("high");
    expect(parsed.options.hideThinkingSummary).toBe(true);
  });

  test("omitted reasoning and omitted effort still default to hideThinkingSummary", () => {
    const parsed = parseRequest({
      model: "test-model",
      input: [{ type: "message", role: "user", content: [{ type: "input_text", text: "hi" }] }],
    });
    expect(parsed.options.hideThinkingSummary).toBe(true);
  });

  test("reasoning effort of none defaults to hideThinkingSummary", () => {
    const parsed = parseRequest({
      model: "test-model",
      reasoning: { effort: "none" },
      input: [{ type: "message", role: "user", content: [{ type: "input_text", text: "hi" }] }],
    });
    expect(parsed.options.hideThinkingSummary).toBe(true);
  });

  test("combo injected effort defaults summary to auto", () => {
    const target: Pick<OcxComboTarget, "provider" | "model"> = {
      provider: "test-provider",
      model: "test-model",
    };
    const body = { model: "combo/test", input: [] };
    const child = concreteComboRequestBody(body, target, "high", ["high"]);
    expect(child.reasoning).toEqual({ effort: "high", summary: "auto" });
  });
});
