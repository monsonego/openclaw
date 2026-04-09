import { describe, expect, it } from "vitest";
import { resolvePreferredServerChatModel } from "./chat-model-ref.ts";

describe("chat-model-ref provider prefix handling", () => {
  it("qualifies slash-containing server values when the catalog confirms the provider-owned ref", () => {
    const catalog = [
      {
        id: "anthropic/claude-haiku-4.5",
        name: "Claude Haiku 4.5",
        provider: "openrouter",
      },
    ];

    expect(
      resolvePreferredServerChatModel("anthropic/claude-haiku-4.5", "openrouter", catalog),
    ).toEqual({
      value: "openrouter/anthropic/claude-haiku-4.5",
      source: "catalog",
    });
  });
});
