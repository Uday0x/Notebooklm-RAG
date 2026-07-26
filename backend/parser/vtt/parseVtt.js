import { SOURCE_TYPES } from "../parser.types.js";
import {
  assertNonEmptySegments,
  cleanText,
} from "../parser.utils.js";

/**
 * Flow: VTT content → read timestamp cues → clean subtitle text → return timestamp segments.
 */

function timestampToSeconds(timestamp) {
  const parts = timestamp.trim().replace(",", ".").split(":");

  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts.map(Number);

    return hours * 3600 + minutes * 60 + seconds;
  }

  if (parts.length === 2) {
    const [minutes, seconds] = parts.map(Number);

    return minutes * 60 + seconds;
  }

  throw new Error(`Invalid VTT timestamp: ${timestamp}`);
}

function cleanCaptionText(value) {
  return cleanText(
    value
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
  );
}

export async function parseVtt({
  content,
  title = "Untitled subtitles",
}) {
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("VTT parser requires non-empty content");
  }

  const normalisedContent = content
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n");

  const blocks = normalisedContent.split(/\n{2,}/);

  const segments = [];
  let previousText = "";

  for (const block of blocks) {
    const lines = block
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      continue;
    }

    if (
      lines[0] === "WEBVTT" ||
      lines[0].startsWith("NOTE") ||
      lines[0].startsWith("STYLE") ||
      lines[0].startsWith("REGION")
    ) {
      continue;
    }

    const timestampLineIndex = lines.findIndex((line) =>
      line.includes("-->")
    );

    if (timestampLineIndex === -1) {
      continue;
    }

    const timestampLine = lines[timestampLineIndex];
    const [rawStart, rawEndWithSettings] =
      timestampLine.split("-->");

    const rawEnd = rawEndWithSettings.trim().split(/\s+/)[0];

    const text = cleanCaptionText(
      lines.slice(timestampLineIndex + 1).join(" ")
    );

    if (!text || text === previousText) {
      continue;
    }

    previousText = text;

    segments.push({
      text,
      location: {
        cueIndex: segments.length + 1,
        startSeconds: timestampToSeconds(rawStart),
        endSeconds: timestampToSeconds(rawEnd),
      },
    });
  }

  return {
    title,
    sourceType: SOURCE_TYPES.VTT,
    segments: assertNonEmptySegments(
      segments,
      SOURCE_TYPES.VTT
    ),
  };
}