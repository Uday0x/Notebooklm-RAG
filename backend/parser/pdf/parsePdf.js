import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFParse } from "pdf-parse";

import { SOURCE_TYPES } from "../parser.types.js";
import {
  assertNonEmptySegments,
  splitIntoParagraphs,
} from "../parser.utils.js";

/**
 * Flow: PDF path/buffer → pdf-parse extracts page text → paragraphs → page-aware segments.
 */
export async function parsePdf({
  filePath,
  buffer,
  title,
}) {
  if (!filePath && !buffer) {
    throw new Error("PDF parser requires filePath or buffer");
  }

  const pdfBuffer = buffer ?? (await readFile(filePath));

  const parser = new PDFParse({
    data: pdfBuffer,
  });

  try {
    const infoResult = await parser.getInfo({
      parsePageInfo: true,
    });

    const totalPages = infoResult.total ?? 0;
    const segments = [];

    for (
      let pageNumber = 1;
      pageNumber <= totalPages;
      pageNumber += 1
    ) {
      const pageResult = await parser.getText({
        partial: [pageNumber],
      });

      const paragraphs = splitIntoParagraphs(pageResult.text);

      paragraphs.forEach((text, paragraphIndex) => {
        segments.push({
          text,
          location: {
            pageNumber,
            paragraphIndex: paragraphIndex + 1,
          },
        });
      });
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