import dns from "node:dns/promises";
import net from "node:net";

import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";

import { config } from "../../config/index.js";
import { SOURCE_TYPES } from "../parser.types.js";
import {
  assertNonEmptySegments,
  cleanText,
} from "../parser.utils.js";

const BLOCKED_SELECTORS =
  "script, style, noscript, svg, nav, footer, form, header, iframe";

export const WEBSITE_EXTRACTION_METHODS = Object.freeze({
  READABILITY: "readability",
  MAIN: "main",
  ARTICLE: "article",
  BODY: "body",
  PLAYWRIGHT_READABILITY: "playwright-readability",
  PLAYWRIGHT_MAIN: "playwright-main",
  PLAYWRIGHT_ARTICLE: "playwright-article",
  PLAYWRIGHT_ROLE_MAIN: "playwright-role-main",
  PLAYWRIGHT_BODY: "playwright-body",
});

export class WebsiteParserError extends Error {
  constructor(message, { permanent = true, code = "WEBSITE_PARSE_FAILED" } = {}) {
    super(message);
    this.name = "WebsiteParserError";
    this.permanent = permanent;
    this.code = code;
  }
}

/**
 * Flow: Website URL -> safe bounded HTML fetch -> Readability -> DOM fallbacks
 * -> optional browser-rendered extraction -> heading-aware segments.
 */
export async function parseWebsite({
  url,
  title,
  fetchImpl = fetch,
  browserFactory,
  readabilityParser = defaultReadabilityParser,
  logger = console,
}) {
  const requestedUrl = normalizeHttpUrl(url);
  logger.info?.(
    `Website browser fallback enabled value: ${config.websiteBrowserFallbackEnabled}`
  );

  try {
    const fetched = await fetchHtml(requestedUrl, {
      fetchImpl,
      logger,
    });
    const staticExtractionStats = {};

    const extracted = extractFromHtml(fetched.html, fetched.url, {
      minReadableTextLength: config.websiteMinReadableTextLength,
      readabilityParser,
      logger,
      extractionStats: staticExtractionStats,
    });

    logger.info?.(
      `Static extracted character count: ${
        extracted?.characterCount ?? staticExtractionStats.characterCount ?? 0
      }`
    );

    if (!extracted && config.websiteBrowserFallbackEnabled) {
      const rendered = await parseWithBrowserFallback({
        url: fetched.url,
        title,
        browserFactory,
        readabilityParser,
        logger,
      });

      return rendered;
    }

    if (!extracted && appearsJavaScriptRendered(fetched.html)) {
      if (!config.websiteBrowserFallbackEnabled) {
        throw new WebsiteParserError(
          "The webpage requires JavaScript and browser fallback is disabled.",
          { code: "WEBSITE_JAVASCRIPT_REQUIRED" }
        );
      }

      return await parseWithBrowserFallback({
        url: fetched.url,
        title,
        browserFactory,
        readabilityParser,
        logger,
      });
    }

    if (!extracted) {
      throw new WebsiteParserError(
        "The webpage did not contain enough readable text.",
        { code: "WEBSITE_INSUFFICIENT_TEXT" }
      );
    }

    logger.info?.(
      `Website extracted ${extracted.characterCount} characters with ${extracted.extractionMethod}`
    );
    logger.info?.(`Final extracted character count: ${extracted.characterCount}`);

    return buildParserResult({
      title: title ?? extracted.title ?? fetched.url,
      url: fetched.url,
      extracted,
    });
  } catch (error) {
    const normalized = normalizeWebsiteError(error);
    logger.warn?.(`Website parsing failed: ${normalized.message}`);
    throw normalized;
  }
}

function normalizeHttpUrl(value) {
  try {
    const parsed = new URL(value);

    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new WebsiteParserError("Invalid URL", {
        code: "WEBSITE_INVALID_URL",
      });
    }

    parsed.username = "";
    parsed.password = "";
    return parsed.toString();
  } catch (error) {
    if (error instanceof WebsiteParserError) {
      throw error;
    }

    throw new WebsiteParserError("Invalid URL", {
      code: "WEBSITE_INVALID_URL",
    });
  }
}

async function fetchHtml(
  initialUrl,
  {
    fetchImpl,
    logger,
    timeoutMs = config.websiteTimeoutMs,
    maxResponseBytes = config.websiteMaxResponseBytes,
    redirectLimit = config.websiteRedirectLimit,
  }
) {
  let currentUrl = initialUrl;

  for (let redirects = 0; redirects <= redirectLimit; redirects += 1) {
    await assertSafePublicUrl(currentUrl);
    logger.info?.(`Website fetch started: ${safeUrlForLog(currentUrl)}`);

    let response;
    try {
      response = await fetchImpl(currentUrl, {
        redirect: "manual",
        headers: {
          "User-Agent": "Mozilla/5.0 NotebookLM-RAG-Parser/1.0",
          Accept: "text/html,application/xhtml+xml",
        },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      if (isTimeoutError(error) || isTemporaryDnsError(error)) {
        throw new WebsiteParserError(
          "The webpage could not be reached.",
          { permanent: false, code: "WEBSITE_UNREACHABLE" }
        );
      }

      throw new WebsiteParserError(
        "The webpage could not be reached.",
        { code: "WEBSITE_UNREACHABLE" }
      );
    }

    const status = response.status;
    const contentType = response.headers.get("content-type") ?? "";
    logger.info?.(
      `Website response: status=${status} content-type=${safeHeaderForLog(contentType)}`
    );

    if (isRedirectStatus(status)) {
      const location = response.headers.get("location");

      if (!location) {
        throw new WebsiteParserError(
          "The webpage could not be reached.",
          { code: "WEBSITE_INVALID_REDIRECT" }
        );
      }

      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }

    if (status === 401 || status === 403) {
      throw new WebsiteParserError(
        "The webpage blocked automated access.",
        { code: "WEBSITE_ACCESS_BLOCKED" }
      );
    }

    if ([429, 500, 502, 503, 504].includes(status)) {
      throw new WebsiteParserError(
        "The webpage could not be reached.",
        { permanent: false, code: "WEBSITE_RETRYABLE_HTTP" }
      );
    }

    if (!response.ok) {
      throw new WebsiteParserError(
        "The webpage could not be reached.",
        { code: "WEBSITE_HTTP_FAILED" }
      );
    }

    if (!contentType.toLowerCase().includes("text/html")) {
      throw new WebsiteParserError(
        "The webpage returned an unsupported content type.",
        { code: "WEBSITE_UNSUPPORTED_CONTENT_TYPE" }
      );
    }

    return {
      url: currentUrl,
      html: await readResponseText(response, maxResponseBytes),
    };
  }

  throw new WebsiteParserError(
    "The webpage could not be reached.",
    { code: "WEBSITE_TOO_MANY_REDIRECTS" }
  );
}

async function readResponseText(response, maxResponseBytes) {
  const reader = response.body?.getReader?.();

  if (!reader) {
    const text = await response.text();
    if (Buffer.byteLength(text, "utf8") > maxResponseBytes) {
      throw new WebsiteParserError(
        "The webpage could not be reached.",
        { code: "WEBSITE_RESPONSE_TOO_LARGE" }
      );
    }
    return text;
  }

  const chunks = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    total += value.byteLength;

    if (total > maxResponseBytes) {
      throw new WebsiteParserError(
        "The webpage could not be reached.",
        { code: "WEBSITE_RESPONSE_TOO_LARGE" }
      );
    }

    chunks.push(value);
  }

  return new TextDecoder().decode(Buffer.concat(chunks));
}

function extractFromHtml(
  html,
  url,
  {
    minReadableTextLength,
    readabilityParser = defaultReadabilityParser,
    logger,
    playwright = false,
    extractionStats,
  } = {}
) {
  const readability = extractReadability(html, url, readabilityParser);
  let bestCharacterCount = readability?.characterCount ?? 0;

  if (hasEnoughReadableText(readability?.text, minReadableTextLength)) {
    logger.info?.("Readability extraction succeeded");
    const extractionMethod = playwright
      ? WEBSITE_EXTRACTION_METHODS.PLAYWRIGHT_READABILITY
      : WEBSITE_EXTRACTION_METHODS.READABILITY;

    const extracted = {
      ...readability,
      extractionMethod,
      segments: readability.segments.map((segment) => ({
        ...segment,
        location: {
          ...segment.location,
          extractionMethod,
        },
      })),
    };
    extractionStats && (extractionStats.characterCount = extracted.characterCount);
    return extracted;
  }

  logger.info?.("Readability extraction failed");

  const dom = new JSDOM(html, { url });
  const document = dom.window.document;
  document.querySelectorAll(BLOCKED_SELECTORS).forEach((element) => {
    element.remove();
  });

  const candidates = [
    [
      playwright
        ? WEBSITE_EXTRACTION_METHODS.PLAYWRIGHT_MAIN
        : WEBSITE_EXTRACTION_METHODS.MAIN,
      document.querySelector("main"),
    ],
    [
      playwright
        ? WEBSITE_EXTRACTION_METHODS.PLAYWRIGHT_ARTICLE
        : WEBSITE_EXTRACTION_METHODS.ARTICLE,
      document.querySelector("article"),
    ],
    [
      playwright
        ? WEBSITE_EXTRACTION_METHODS.PLAYWRIGHT_ROLE_MAIN
        : WEBSITE_EXTRACTION_METHODS.MAIN,
      document.querySelector('[role="main"]'),
    ],
    [
      playwright
        ? WEBSITE_EXTRACTION_METHODS.PLAYWRIGHT_BODY
        : WEBSITE_EXTRACTION_METHODS.BODY,
      document.body,
    ],
  ];

  for (const [method, element] of candidates) {
    if (!element) {
      continue;
    }

    const segments = segmentsFromElement(element, {
      url,
      extractionMethod: method,
    });
    const text = segments.map((segment) => segment.text).join("\n\n");
    const landmarkText = cleanText(element.textContent);
    const candidateSegments =
      hasEnoughReadableText(text, minReadableTextLength) ||
      !hasEnoughReadableText(landmarkText, minReadableTextLength)
        ? segments
        : [
            {
              text: landmarkText,
              location: {
                url,
                sourceUrl: url,
                hostname: new URL(url).hostname,
                extractionMethod: method,
                paragraphIndex: 1,
                headingPath: [],
              },
            },
          ];
    const candidateText = candidateSegments
      .map((segment) => segment.text)
      .join("\n\n");
    bestCharacterCount = Math.max(bestCharacterCount, candidateText.length);

    if (hasEnoughReadableText(candidateText, minReadableTextLength)) {
      const extractionMethod = method;
      logger.info?.(
        `${playwright ? "Rendered" : "DOM fallback"} extraction method: ${extractionMethod}`
      );
      const extracted = {
        title: cleanText(document.title) || null,
        text: candidateText,
        segments: candidateSegments,
        extractionMethod,
        characterCount: candidateText.length,
      };
      extractionStats && (extractionStats.characterCount = extracted.characterCount);
      return extracted;
    }
  }

  extractionStats && (extractionStats.characterCount = bestCharacterCount);
  return null;
}

function extractReadability(html, url, readabilityParser) {
  const dom = new JSDOM(html, { url });
  const article = readabilityParser(
    dom.window.document.cloneNode(true)
  );

  if (!article?.content) {
    return null;
  }

  const articleDom = new JSDOM(`<main>${article.content}</main>`, { url });
  const main = articleDom.window.document.querySelector("main");
  const segments = segmentsFromElement(main, {
    url,
    extractionMethod: WEBSITE_EXTRACTION_METHODS.READABILITY,
  });
  const text = segments.map((segment) => segment.text).join("\n\n");

  return {
    title: article.title,
    text,
    segments,
    characterCount: text.length,
    metadata: {
      byline: article.byline ?? null,
      excerpt: article.excerpt ?? null,
      siteName: article.siteName ?? null,
      language: article.lang ?? null,
      publishedTime: article.publishedTime ?? null,
    },
  };
}

function segmentsFromElement(element, { url, extractionMethod }) {
  const target = element ?? null;
  if (!target) {
    return [];
  }

  const hostname = new URL(url).hostname;
  const elements = target.querySelectorAll("h1, h2, h3, h4, h5, h6, p, li");
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
        url,
        sourceUrl: url,
        hostname,
        extractionMethod,
        paragraphIndex: segments.length + 1,
        headingPath: headingPath.filter(Boolean),
      },
    });
  }

  if (segments.length > 0) {
    return segments;
  }

  const text = cleanText(target.textContent);
  return text
    ? [
        {
          text,
          location: {
            url,
            sourceUrl: url,
            hostname,
            extractionMethod,
            paragraphIndex: 1,
            headingPath: [],
          },
        },
      ]
    : [];
}

async function parseWithBrowserFallback({
  url,
  title,
  browserFactory,
  readabilityParser,
  logger,
}) {
  let browser;
  let page;

  try {
    logger.info?.("Playwright fallback started");
    browser = browserFactory
      ? await browserFactory()
      : await launchPlaywrightBrowser();
    logger.info?.("Chromium launched");
    page = await browser.newPage();
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: config.websiteTimeoutMs,
    });
    logger.info?.("Page navigation completed");

    if (typeof page.waitForLoadState === "function") {
      await page
        .waitForLoadState("networkidle", { timeout: 3_000 })
        .catch(() => {});
    }
    await page.waitForTimeout?.(1_500);

    const pageTitle = cleanText((await page.title?.()) ?? "");
    logger.info?.(`Page title: ${pageTitle || "untitled"}`);

    const renderedBodyText = await getRenderedBodyText(page);
    logger.info?.(
      `Rendered body innerText character count: ${renderedBodyText.length}`
    );

    const renderedHtml = await page.content();
    const extracted = extractFromHtml(renderedHtml, url, {
      minReadableTextLength: config.websiteMinReadableTextLength,
      readabilityParser,
      logger,
      playwright: true,
    });

    if (!extracted) {
      throw new WebsiteParserError(
        "The webpage did not contain enough readable text.",
        { code: "WEBSITE_INSUFFICIENT_TEXT" }
      );
    }

    logger.info?.("Playwright fallback completed");
    logger.info?.(`Rendered extraction method: ${extracted.extractionMethod}`);
    logger.info?.(
      `Website extracted ${extracted.characterCount} characters with ${extracted.extractionMethod}`
    );
    logger.info?.(`Final extracted character count: ${extracted.characterCount}`);

    return buildParserResult({
      title: title ?? extracted.title ?? url,
      url,
      extracted,
    });
  } catch (error) {
    throw normalizeWebsiteError(error);
  } finally {
    await page?.close?.().catch?.(() => {});
    await browser?.close?.().catch?.(() => {});
  }
}

function defaultReadabilityParser(document) {
  return new Readability(document).parse();
}

async function launchPlaywrightBrowser() {
  try {
    const { chromium } = await import("playwright");
    return chromium.launch({ headless: true });
  } catch (error) {
    throw new WebsiteParserError(
      "The webpage requires JavaScript and browser fallback is disabled.",
      { code: "WEBSITE_BROWSER_UNAVAILABLE" }
    );
  }
}

async function getRenderedBodyText(page) {
  const text =
    (await page
      .evaluate?.(() => document.body?.innerText ?? "")
      .catch?.(() => "")) ?? "";

  return cleanText(text);
}

function buildParserResult({ title, extracted }) {
  return {
    title,
    sourceType: SOURCE_TYPES.WEBSITE,
    segments: assertNonEmptySegments(
      extracted.segments,
      SOURCE_TYPES.WEBSITE
    ),
    metadata: extracted.metadata ?? {},
  };
}

function hasEnoughReadableText(value, minimumLength) {
  return cleanText(value).length >= minimumLength;
}

function appearsJavaScriptRendered(html) {
  const dom = new JSDOM(html);
  const document = dom.window.document;
  const bodyText = cleanText(document.body?.textContent ?? "");
  const scriptCount = document.querySelectorAll("script").length;
  const rootShell =
    document.querySelector("#root, #app, [data-reactroot]") !== null;

  return bodyText.length < config.websiteMinReadableTextLength && (rootShell || scriptCount > 3);
}

async function assertSafePublicUrl(value) {
  const parsed = new URL(value);

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new WebsiteParserError("Invalid URL", {
      code: "WEBSITE_INVALID_URL",
    });
  }

  if (parsed.username || parsed.password) {
    throw new WebsiteParserError("Invalid URL", {
      code: "WEBSITE_INVALID_URL",
    });
  }

  if (isUnsafeHostname(parsed.hostname)) {
    throw new WebsiteParserError("Invalid URL", {
      code: "WEBSITE_UNSAFE_URL",
    });
  }

  const addresses = await dns.lookup(parsed.hostname, { all: true });

  if (addresses.some(({ address }) => isUnsafeIpAddress(address))) {
    throw new WebsiteParserError("Invalid URL", {
      code: "WEBSITE_UNSAFE_URL",
    });
  }
}

function isUnsafeHostname(hostname) {
  const normalized = hostname
    .toLowerCase()
    .replace(/\.$/, "")
    .replace(/^\[(.*)]$/, "$1");

  if (["localhost", "metadata.google.internal"].includes(normalized)) {
    return true;
  }

  return isUnsafeIpAddress(normalized);
}

function isUnsafeIpAddress(value) {
  const ipType = net.isIP(value);

  if (ipType === 4) {
    const [a, b] = value.split(".").map(Number);
    return (
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      value === "0.0.0.0"
    );
  }

  if (ipType === 6) {
    const normalized = value.toLowerCase();
    const mappedIpv4 = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);

    if (mappedIpv4) {
      return isUnsafeIpAddress(mappedIpv4[1]);
    }

    return (
      normalized === "::1" ||
      normalized === "::" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe80:")
    );
  }

  return false;
}

function isRedirectStatus(status) {
  return [301, 302, 303, 307, 308].includes(status);
}

function isTimeoutError(error) {
  return error?.name === "TimeoutError" || error?.name === "AbortError";
}

function isTemporaryDnsError(error) {
  return (error?.cause?.code ?? error?.code) === "EAI_AGAIN";
}

function normalizeWebsiteError(error) {
  if (error instanceof WebsiteParserError) {
    return error;
  }

  if (isTimeoutError(error) || isTemporaryDnsError(error)) {
    return new WebsiteParserError(
      "The webpage could not be reached.",
      { permanent: false, code: "WEBSITE_UNREACHABLE" }
    );
  }

  return new WebsiteParserError(
    "The webpage could not be reached.",
    { code: "WEBSITE_UNREACHABLE" }
  );
}

function safeUrlForLog(value) {
  const parsed = new URL(value);
  return `${parsed.protocol}//${parsed.hostname}${parsed.pathname}`;
}

function safeHeaderForLog(value) {
  return String(value).split(";")[0].slice(0, 80) || "missing";
}
