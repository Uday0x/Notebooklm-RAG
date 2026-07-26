import { describe, expect, it } from "vitest";
import { appendToken, parseSseChunk } from "./sse";

describe("parseSseChunk", () => {
  it("handles an event split across network chunks", () => {
    const first = parseSseChunk('event: token\ndata: {"content":"hel');
    expect(first.events).toEqual([]);
    expect(first.rest).toBe('event: token\ndata: {"content":"hel');

    const second = parseSseChunk(`${first.rest}lo"}\n\n`);
    expect(second.events).toEqual([{ event: "token", data: { content: "hello" } }]);
    expect(second.rest).toBe("");
  });

  it("handles multiple events in one network chunk", () => {
    const parsed = parseSseChunk(
      'event: metadata\ndata: {"conversationTitle":"Notes"}\n\n' +
        'event: complete\ndata: {"answer":"done","citations":[]}\n\n',
    );

    expect(parsed.events).toHaveLength(2);
    expect(parsed.events[0].event).toBe("metadata");
    expect(parsed.events[1].data.answer).toBe("done");
  });

  it("appends token content", () => {
    expect(appendToken("hel", { event: "token", data: { content: "lo" } })).toBe("hello");
  });
});
