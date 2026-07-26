import { SOURCE_TYPES } from "../parser.types.js";
import {
  assertNonEmptySegments,
  cleanText,
} from "../parser.utils.js";

/**
 * Flow: Plain text → detect paragraphs → preserve line positions → return segments.
 */
export async function parseText({
  content,
  title = "Untitled text",
}) {
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("Text parser requires non-empty content");
  }

  const normalisedText = content.replace(/\r\n/g, "\n");
  const lines = normalisedText.split("\n");

  const segments = [];

  let paragraphLines = [];
  let paragraphStartLine = 1;

  function pushParagraph(endLine) {
    const text = cleanText(paragraphLines.join("\n"));

    if (text) {
      segments.push({
        text,
        location: {
          paragraphIndex: segments.length + 1,
          startLine: paragraphStartLine,
          endLine,
        },
      });
    }

    paragraphLines = [];
  }

  lines.forEach((line, index) => {
    const currentLineNumber = index + 1;

    if (!line.trim()) {
      if (paragraphLines.length > 0) {
        pushParagraph(currentLineNumber - 1);
      }

      paragraphStartLine = currentLineNumber + 1;
      return;
    }

    if (paragraphLines.length === 0) {
      paragraphStartLine = currentLineNumber;
    }

    paragraphLines.push(line);
  });

  if (paragraphLines.length > 0) {
    pushParagraph(lines.length);
  }

  return {
    title,
    sourceType: SOURCE_TYPES.TEXT,
    segments: assertNonEmptySegments(
      segments,
      SOURCE_TYPES.TEXT
    ),
  };
}