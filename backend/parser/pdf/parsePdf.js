import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFParse } from "pdf-parse";

import { SOURCE_TYPES } from "../parser.types.js";
import {
  assertNonEmptySegments,
  cleanText,
  splitIntoParagraphs,
} from "../parser.utils.js";

export class PdfParserError extends Error {
  constructor(message) {
    super(message);
    this.name = "PdfParserError";
    this.permanent = true;
    this.code = "PDF_NO_EXTRACTABLE_TEXT";
  }
}

/**
 * Flow: PDF path/buffer → pdf-parse extracts page text → paragraphs → page-aware segments.
 */
export async function parsePdf({
  filePath,
  buffer,
  title,
  pdfParserFactory = (pdfBuffer) => new PDFParse({ data: pdfBuffer }),
  logger = console,
}) {
  if (!filePath && !buffer) {
    throw new Error("PDF parser requires filePath or buffer");
  }

  const pdfBuffer = buffer ?? (await readFile(filePath));

  const parser = pdfParserFactory(pdfBuffer);

  try {
    const infoResult = await parser.getInfo({
      parsePageInfo: true,
    });

    const totalPages = infoResult.total ?? 0;
    const segments = [];
    const pageTextLengths = [];

    for (
      let pageNumber = 1;
      pageNumber <= totalPages;
      pageNumber += 1
    ) {
      const pageResult = await parser.getText({
        partial: [pageNumber],
      });

      const pageText = cleanPdfPageText(pageResult.text);
      pageTextLengths.push(pageText.length);

      const paragraphs = splitIntoParagraphs(pageText)
        .filter(isMeaningfulPdfText);

      paragraphs.forEach((text, paragraphIndex) => {
        segments.push({
          text,
          location: {
            pageNumber,
            pageStart: pageNumber,
            pageEnd: pageNumber,
            totalPages,
            paragraphIndex: paragraphIndex + 1,
          },
        });
      });
    }

    debugPdfPipeline(logger, {
      totalPages,
      segments,
      pageTextLengths,
    });

    if (segments.length === 0) {
      throw new PdfParserError(
        "The PDF did not contain extractable text. It may be scanned or image-based. OCR is not currently enabled."
      );
    }

    return {
      title:
        title ??
        infoResult.infoData?.Title ??
        (filePath
          ? path.basename(filePath)
          : "Untitled PDF"),

      sourceType: SOURCE_TYPES.PDF,

      segments: assertNonEmptySegments(
        segments,
        SOURCE_TYPES.PDF
      ),
    };
  } finally {
    await parser.destroy();
  }
}

export function cleanPdfPageText(value = "") {
  return cleanText(value)
    .split("\n")
    .map((line) => cleanText(line))
    .filter((line) => !isPdfMarkerOnlyText(line))
    .join("\n");
}

export function isMeaningfulPdfText(value = "") {
  const text = cleanText(value);
  if (!text) return false;
  if (isPdfMarkerOnlyText(text)) return false;

  const withoutMarkers = text
    .split("\n")
    .map((line) => cleanText(line))
    .filter((line) => !isPdfMarkerOnlyText(line))
    .join(" ");

  const words = withoutMarkers.match(/[A-Za-z]{3,}/g) ?? [];
  const alphaCharacters = withoutMarkers.match(/[A-Za-z]/g) ?? [];

  return alphaCharacters.length >= 24 && words.length >= 4;
}

export function isPdfMarkerOnlyText(value = "") {
  const text = cleanText(value);
  if (!text) return true;

  const markerPatterns = [
    /^[-\s]*\d+\s+of\s+\d+[-\s]*$/i,
    /^[-\s]*page\s+\d+[-\s]*$/i,
    /^[-\s]*\d+[-\s]*$/i,
    /^[-\s]*unit\s+\d+[-\s]*$/i,
    /^[-\s]*$/i,
  ];

  return markerPatterns.some((pattern) => pattern.test(text));
}

function debugPdfPipeline(logger, { totalPages, segments, pageTextLengths }) {
  if (
    process.env.NODE_ENV !== "development" ||
    process.env.PDF_PIPELINE_DEBUG !== "true"
  ) {
    return;
  }

  logger.debug?.("PDF parsed pages:", totalPages);
  logger.debug?.("PDF first page text lengths:", pageTextLengths.slice(0, 3));
  logger.debug?.(
    "PDF first segments:",
    segments.slice(0, 3).map((segment) => ({
      text: segment.text.slice(0, 180),
      textLength: segment.text.length,
      location: segment.location,
    }))
  );
}
