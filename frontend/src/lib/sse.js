import { apiUrl, ApiError } from "../api/client";

export function parseSseChunk(buffer) {
  const events = [];
  const blocks = buffer.split(/\n\n/);
  const rest = blocks.pop() ?? "";

  for (const block of blocks) {
    let event = "message";
    const dataLines = [];

    for (const rawLine of block.split(/\n/)) {
      const line = rawLine.replace(/\r$/, "");
      if (line.startsWith("event:")) event = line.slice(6).trim();
      if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
    }

    const dataText = dataLines.join("\n");
    events.push({
      event,
      data: dataText ? JSON.parse(dataText) : null,
    });
  }

  return { events, rest };
}

export async function streamMessage({
  conversationId,
  content,
  sourceIds = [],
  limit,
  signal,
  onEvent,
}) {
  const response = await fetch(apiUrl(`/api/conversations/${conversationId}/messages`), {
    method: "POST",
    headers: {
      Accept: "text/event-stream",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ content, sourceIds, limit }),
    signal,
  });

  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => "");
    throw new ApiError(text || "Unable to stream message", { status: response.status });
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parsed = parseSseChunk(buffer);
    buffer = parsed.rest;
    for (const item of parsed.events) onEvent(item);
  }

  if (buffer.trim()) {
    const parsed = parseSseChunk(`${buffer}\n\n`);
    for (const item of parsed.events) onEvent(item);
  }
}

export function appendToken(current, event) {
  return event.event === "token" ? `${current}${event.data?.content ?? ""}` : current;
}
