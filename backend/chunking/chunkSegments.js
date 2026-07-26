import {
  joinSegmentTexts,
  mergeLocations,
} from "./chunking.utils.js";

export function chunkSegments(
  segments,
  {
    maxCharacters = 1000,
    overlapSegments = 1,
  } = {}
) {
  if (!Array.isArray(segments) || segments.length === 0) {
    throw new Error(
      "chunkSegments requires at least one segment"
    );
  }

  if (maxCharacters <= 0) {
    throw new Error(
      "maxCharacters must be greater than zero"
    );
  }

  if (overlapSegments < 0) {
    throw new Error(
      "overlapSegments cannot be negative"
    );
  }

  const chunks = [];

  let currentSegments = [];
  let currentLength = 0;

  function createChunk() {
    if (currentSegments.length === 0) {
      return;
    }

    const text = joinSegmentTexts(currentSegments);

    if (!isMeaningfulChunkText(text)) {
      return;
    }

    chunks.push({
      chunkIndex: chunks.length + 1,
      text,
      location: mergeLocations(currentSegments),
      segmentCount: currentSegments.length,
    });
  }

  for (const segment of segments) {
    if (!segment?.text?.trim()) {
      continue;
    }

    const separatorLength =
      currentSegments.length > 0 ? 2 : 0;

    const newLength =
      currentLength +
      separatorLength +
      segment.text.length;

    const exceedsLimit =
      currentSegments.length > 0 &&
      newLength > maxCharacters;

    if (exceedsLimit) {
      createChunk();

      currentSegments =
        overlapSegments > 0
          ? currentSegments.slice(-overlapSegments)
          : [];

      currentLength =
        joinSegmentTexts(currentSegments).length;
    }

    currentSegments.push(segment);

    currentLength =
      joinSegmentTexts(currentSegments).length;
  }

  createChunk();

  if (chunks.length === 0) {
    throw new Error(
      "Chunker could not create meaningful chunks from extracted text"
    );
  }

  return chunks;
}

function isMeaningfulChunkText(value = "") {
  const text = value.trim();
  if (!text) return false;

  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const meaningfulLines = lines.filter((line) => !isMarkerOnlyLine(line));
  const content = meaningfulLines.join(" ");
  const words = content.match(/[A-Za-z]{3,}/g) ?? [];

  return content.length >= 24 && words.length >= 4;
}

function isMarkerOnlyLine(value = "") {
  return [
    /^[-\s]*\d+\s+of\s+\d+[-\s]*$/i,
    /^[-\s]*page\s+\d+[-\s]*$/i,
    /^[-\s]*\d+[-\s]*$/i,
    /^[-\s]*unit\s+\d+[-\s]*$/i,
  ].some((pattern) => pattern.test(value.trim()));
}
