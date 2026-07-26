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

  return chunks;
}