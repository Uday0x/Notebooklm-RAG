import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";

import { SOURCE_TYPES } from "../parser.types.js";
import {
  assertNonEmptySegments,
  cleanText,
} from "../parser.utils.js";

/**
 * Flow: Website URL → fetch HTML → Readability extracts main article → heading-aware segments.
 */
export async function parseWebsite({
  url,
  title,
}) {
  if (!url) {
    throw new Error("Website parser requires a URL");
  }

  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 NotebookLM-RAG-Parser/1.0",
      Accept: "text/html,application/xhtml+xml",
    },

    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(
      `Website request failed with status ${response.status}`
    );
  }

  const contentType =
    response.headers.get("content-type") ?? "";

  if (!contentType.includes("text/html")) {
    throw new Error(
      `Expected HTML but received ${contentType}`
    );
  }

  const html = await response.text();

  const dom = new JSDOM(html, {
    url,
  });

  const reader = new Readability(
    dom.window.document.cloneNode(true)
  );

  const article = reader.parse();

  if (!article?.content) {
    throw new Error(
      "Readability could not extract the webpage article"
    );
  }

  const articleDom = new JSDOM(
    `<main>${article.content}</main>`
  );

  const elements =
    articleDom.window.document.querySelectorAll(
      "h1, h2, h3, h4, h5, h6, p, li"
    );

  const headingPath = [];
  const segments = [];

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
        sourceUrl: url,
        paragraphIndex: segments.length + 1,
        headingPath: headingPath.filter(Boolean),
      },
    });
  }

  return {
    title: title ?? article.title ?? url,
    sourceType: SOURCE_TYPES.WEBSITE,

    segments: assertNonEmptySegments(
      segments,
      SOURCE_TYPES.WEBSITE
    ),

    metadata: {
      byline: article.byline ?? null,
      excerpt: article.excerpt ?? null,
      siteName: article.siteName ?? null,
      language: article.lang ?? null,
      publishedTime: article.publishedTime ?? null,
    },
  };
}