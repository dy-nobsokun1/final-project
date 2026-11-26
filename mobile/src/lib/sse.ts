// Reads a Server-Sent Events stream (the API's live messages). The body arrives in chunks of bytes;
// an event ends with a blank line. "event:" names it, "data:" carries its text, ":" lines are comments.

export interface SseEvent {
  event: string;
  data: string;
}

/** Calls onEvent for every complete event until the stream ends or is aborted. */
export async function readSseEvents(body: ReadableStream<Uint8Array>, onEvent: (event: SseEvent) => void) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) return;
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
    let end = buffer.indexOf("\n\n");
    while (end !== -1) {
      const block = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      const event = parseBlock(block);
      if (event) onEvent(event);
      end = buffer.indexOf("\n\n");
    }
  }
}

/** One event block -> { event, data }, or null for a comment-only block such as ": ping". */
function parseBlock(block: string): SseEvent | null {
  let event = "message";
  const data: string[] = [];
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
  }
  return data.length > 0 ? { event, data: data.join("\n") } : null;
}
