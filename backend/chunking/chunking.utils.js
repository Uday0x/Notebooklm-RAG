/**
 * Flow: Multiple segment locations → combine them into one chunk location range.
 */
export function mergeLocations(segments) {
  const firstSegment = segments[0];
  const lastSegment = segments[segments.length - 1];
  const firstLocation = firstSegment.location ?? {};
  const lastLocation = lastSegment.location ?? {};

  const pageStart =
    firstLocation.pageStart ??
    firstLocation.pageNumber ??
    firstLocation.page;
  const pageEnd =
    lastLocation.pageEnd ??
    lastLocation.pageNumber ??
    lastLocation.page;

  if (Number.isFinite(Number(pageStart)) || Number.isFinite(Number(pageEnd))) {
    const normalizedPageStart = Number(pageStart ?? pageEnd);
    const normalizedPageEnd = Number(pageEnd ?? pageStart);

    return {
      pageStart: normalizedPageStart,
      pageEnd: normalizedPageEnd,
      ...(firstLocation.totalPages !== undefined && {
        totalPages: firstLocation.totalPages,
      }),
      ...(firstLocation.paragraphIndex !== undefined && {
        paragraphStart: firstLocation.paragraphIndex,
      }),
      ...(lastLocation.paragraphIndex !== undefined && {
        paragraphEnd: lastLocation.paragraphIndex,
      }),
    };
  }

  return {
    start: firstLocation,
    end: lastLocation,
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
