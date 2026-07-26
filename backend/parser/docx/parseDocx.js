import path from "node:path";
import mammoth from "mammoth";
import { JSDOM } from "jsdom";

import { SOURCE_TYPES } from "../parser.types.js";
import {
  assertNonEmptySegments,
  cleanText,
} from "../parser.utils.js";

/**
 * Flow: DOCX → Mammoth HTML → track current heading → paragraph-aware segments.
 */
export async function parseDocx({
  filePath,
  buffer,
  title,
}) {
  if (!filePath && !buffer) {
    throw new Error("DOCX parser requires filePath or buffer");
  }

  const input = buffer
    ? { buffer }
    : { path: filePath };

  const result = await mammoth.convertToHtml(input);

  const dom = new JSDOM(`<main>${result.value}</main>`);
  const document = dom.window.document;

  const elements = document.querySelectorAll(
    "h1, h2, h3, h4, h5, h6, p, li, td, th"
  );

  const segments = [];
  const headingPath = [];

  for (const element of elements) {
    const text = cleanText(element.textContent);

    if (!text) {
      continue;
    }

    const tagName = element.tagName.toLowerCase();

    if (/^h[1-6]$/.test(tagName)) {
      const level = Number(tagName[1]);

      headingPath.splice(level - 1);
      headingPath[level - 1] = text;

      continue;
    }

    segments.push({
      text,
      location: {
        paragraphIndex: segments.length + 1,
        headingPath: headingPath.filter(Boolean),
      },
    });
  }

  return {
    title:
      title ??
      (filePath
        ? path.basename(filePath)
        : "Untitled DOCX"),

    sourceType: SOURCE_TYPES.DOCX,

    segments: assertNonEmptySegments(
      segments,
      SOURCE_TYPES.DOCX
    ),

    warnings: result.messages,
  };
}