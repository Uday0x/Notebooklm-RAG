import { domainFromUrl } from "./format";

export function formatSeconds(value) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds < 0) return null;

  const rounded = Math.floor(seconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const remainingSeconds = rounded % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

export function formatSourceLocation(location = {}, sourceType) {
  const fields = location && typeof location === "object" ? location : {};
  const normalizedType = String(sourceType || "").toUpperCase();
  const page = firstPrimitive(fields.pageNumber, fields.page, fields.pageStart);
  const pageEnd = firstPrimitive(fields.pageEnd);
  const heading = firstPrimitive(fields.heading, fields.section, fields.headingPath?.at?.(-1));
  const paragraph = firstPrimitive(fields.paragraph, fields.paragraphIndex);
  const url = firstPrimitive(fields.url, fields.sourceUrl);
  const hostname = firstPrimitive(fields.hostname, domainFromUrl(url));
  const startSeconds = firstTimeValue(fields.startSeconds, fields.timestamp, fields.start);
  const endSeconds = firstTimeValue(fields.endSeconds, fields.end);

  if (normalizedType === "PDF" && page) {
    return pageEnd && Number(pageEnd) !== Number(page)
      ? [`Pages ${page}-${pageEnd}`]
      : [`Page ${page}`];
  }
  if (["YOUTUBE", "VTT"].includes(normalizedType)) {
    const range = formatTimeRange(startSeconds, endSeconds);
    return range ? [range] : ["Transcript passage"];
  }
  if (normalizedType === "WEBSITE") {
    const parts = [hostname, heading].filter(Boolean);
    if (parts.length) return [parts.join(" · ")];
  }

  const generic = [
    heading,
    page ? `Page ${page}` : null,
    paragraph ? `Paragraph ${paragraph}` : null,
  ].filter(Boolean);

  return generic.length ? generic : ["Relevant passage from this source"];
}

export function formatLocationLabel(location, sourceType) {
  return formatSourceLocation(location, sourceType).join(" · ");
}

export function sourceTypeLabel(sourceType) {
  const normalizedType = String(sourceType || "").toUpperCase();
  return (
    {
      WEBSITE: "Website",
      PDF: "PDF",
      YOUTUBE: "YouTube",
      VTT: "Transcript",
      DOCX: "Document",
      TEXT: "Text source",
    }[normalizedType] || "Source"
  );
}

function formatTimeRange(start, end) {
  const startLabel = formatSeconds(start);
  const endLabel = formatSeconds(end);
  if (startLabel && endLabel && endLabel !== startLabel) return `${startLabel}-${endLabel}`;
  return startLabel || endLabel;
}

function firstPrimitive(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }

  return null;
}

function firstTimeValue(...values) {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
      return Number(value);
    }
    if (value && typeof value === "object") {
      const nested = firstTimeValue(
        value.seconds,
        value.second,
        value.time,
        value.timestamp,
        value.offset,
      );
      if (nested !== null) return nested;
    }
  }

  return null;
}
