/**
 * Flow: Multiple segment locations → combine them into one chunk location range.
 */
export function mergeLocations(segments) {
  const firstSegment = segments[0];
  const lastSegment = segments[segments.length - 1];

  return {
    start: firstSegment.location ?? {},
    end: lastSegment.location ?? {},
  };
}

/**
 * Flow: Array of segment texts → join them into one clean chunk text.
 */
export function joinSegmentTexts(segments) {
  return segments
    .map((segment) => segment.text.trim())
    .filter(Boolean)
    .join("\n\n")
    .trim();
}