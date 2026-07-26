export function cleanText(value = "") {
  return String(value)
    .replace(/\u00A0/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function splitIntoParagraphs(value = "") {
  return cleanText(value)
    .split(/\n\s*\n/)
    .map((paragraph) => cleanText(paragraph))
    .filter(Boolean);
}

export function assertNonEmptySegments(segments, sourceType) {
  if (!Array.isArray(segments) || segments.length === 0) {
    throw new Error(`${sourceType} parser could not extract readable text`);
  }

  return segments;
}