import test from "node:test";
import assert from "node:assert/strict";
import dns from "node:dns/promises";

import { config } from "../config/index.js";
import {
  parseWebsite,
  WebsiteParserError,
} from "../parser/website/parseWebsite.js";

const originalConfig = {
  min: config.websiteMinReadableTextLength,
  browser: config.websiteBrowserFallbackEnabled,
};

test.beforeEach((context) => {
  config.websiteMinReadableTextLength = 80;
  config.websiteBrowserFallbackEnabled = false;
  context.mock.method(dns, "lookup", async () => [
    {
      address: "93.184.216.34",
      family: 4,
    },
  ]);
});

test.afterEach(() => {
  config.websiteMinReadableTextLength = originalConfig.min;
  config.websiteBrowserFallbackEnabled = originalConfig.browser;
});

test("article page where Readability succeeds", async () => {
  const result = await parseWebsite({
    url: "https://example.com/article",
    fetchImpl: htmlFetch(articleHtml()),
    logger: quietLogger(),
  });

  assert.equal(result.sourceType, "WEBSITE");
  assert.equal(
    result.segments[0].location.extractionMethod,
    "readability"
  );
  assert.match(
    result.segments.map((segment) => segment.text).join(" "),
    /layered parsers/i
  );
});

test("page where Readability fails but main element succeeds", async () => {
  const result = await parseWebsite({
    url: "https://example.com/main",
    fetchImpl: htmlFetch(mainFallbackHtml()),
    readabilityParser: () => null,
    logger: quietLogger(),
  });

  assert.equal(
    result.segments[0].location.extractionMethod,
    "main"
  );
});

test("page where body fallback succeeds", async () => {
  const result = await parseWebsite({
    url: "https://example.com/body",
    fetchImpl: htmlFetch(bodyHtml()),
    readabilityParser: () => null,
    logger: quietLogger(),
  });

  assert.equal(
    result.segments[0].location.extractionMethod,
    "body"
  );
});

test("page with too little content fails permanently", async () => {
  await assert.rejects(
    parseWebsite({
      url: "https://example.com/tiny",
      fetchImpl: htmlFetch("<html><body><p>Tiny.</p></body></html>"),
      logger: quietLogger(),
    }),
    (error) =>
      error instanceof WebsiteParserError &&
      error.permanent === true &&
      error.message ===
        "The webpage did not contain enough readable text."
  );
});

test("JavaScript shell page reports disabled browser fallback", async () => {
  await assert.rejects(
    parseWebsite({
      url: "https://example.com/app",
      fetchImpl: htmlFetch(
        '<html><body><div id="root"></div><script></script><script></script><script></script><script></script></body></html>'
      ),
      logger: quietLogger(),
    }),
    (error) =>
      error instanceof WebsiteParserError &&
      error.message ===
        "The webpage requires JavaScript and browser fallback is disabled."
  );
});

test("HTTP 403 is a permanent blocked access failure", async () => {
  await assert.rejects(
    parseWebsite({
      url: "https://example.com/blocked",
      fetchImpl: responseFetch("", {
        status: 403,
        contentType: "text/html",
      }),
      logger: quietLogger(),
    }),
    (error) =>
      error instanceof WebsiteParserError &&
      error.permanent === true &&
      error.message === "The webpage blocked automated access."
  );
});

test("HTTP 500 is retryable", async () => {
  await assert.rejects(
    parseWebsite({
      url: "https://example.com/down",
      fetchImpl: responseFetch("", {
        status: 500,
        contentType: "text/html",
      }),
      logger: quietLogger(),
    }),
    (error) =>
      error instanceof WebsiteParserError &&
      error.permanent === false &&
      error.message === "The webpage could not be reached."
  );
});

test("non-HTML content type fails permanently", async () => {
  await assert.rejects(
    parseWebsite({
      url: "https://example.com/file.pdf",
      fetchImpl: responseFetch("%PDF", {
        status: 200,
        contentType: "application/pdf",
      }),
      logger: quietLogger(),
    }),
    (error) =>
      error instanceof WebsiteParserError &&
      error.permanent === true &&
      error.message ===
        "The webpage returned an unsupported content type."
  );
});

test("localhost and private network URLs are rejected", async () => {
  await assert.rejects(
    parseWebsite({
      url: "http://localhost/private",
      fetchImpl: htmlFetch(articleHtml()),
      logger: quietLogger(),
    }),
    (error) =>
      error instanceof WebsiteParserError &&
      error.permanent === true &&
      error.code === "WEBSITE_UNSAFE_URL"
  );
});

test("redirected URL becoming private is rejected", async (context) => {
  context.mock.restoreAll();
  context.mock.method(dns, "lookup", async (hostname) => {
    if (hostname === "example.com") {
      return [{ address: "93.184.216.34", family: 4 }];
    }

    return [{ address: "127.0.0.1", family: 4 }];
  });

  await assert.rejects(
    parseWebsite({
      url: "https://example.com/redirect",
      fetchImpl: async () =>
        new Response(null, {
          status: 302,
          headers: {
            location: "http://internal.example/private",
          },
        }),
      logger: quietLogger(),
    }),
    (error) =>
      error instanceof WebsiteParserError &&
      error.permanent === true &&
      error.code === "WEBSITE_UNSAFE_URL"
  );
});

test("cleanup after Playwright failure", async () => {
  config.websiteBrowserFallbackEnabled = true;
  let pageClosed = false;
  let browserClosed = false;

  await assert.rejects(
    parseWebsite({
      url: "https://example.com/app",
      fetchImpl: htmlFetch(
        '<html><body><div id="root"></div><script></script><script></script><script></script><script></script></body></html>'
      ),
      browserFactory: async () => ({
        newPage: async () => ({
          goto: async () => {
            throw new Error("render failed");
          },
          close: async () => {
            pageClosed = true;
          },
        }),
        close: async () => {
          browserClosed = true;
        },
      }),
      logger: quietLogger(),
    }),
    WebsiteParserError
  );

  assert.equal(pageClosed, true);
  assert.equal(browserClosed, true);
});

function articleHtml() {
  return `<!doctype html>
    <html>
      <head><title>Parser Notes</title></head>
      <body>
        <article>
          <h1>Parser Notes</h1>
          <p>Layered parsers protect static article pages by using Readability first and then preserving useful paragraphs for grounded retrieval.</p>
          <p>The extracted text is long enough to become readable source material for indexing, chunking, and citation workflows.</p>
        </article>
      </body>
    </html>`;
}

function mainFallbackHtml() {
  return `<!doctype html>
    <html>
      <head><title>Plain Main</title></head>
      <body>
        <main>
          Main fallback prose stays outside ordinary paragraph tags so Readability
          declines the article, while the landmark selector can still recover
          enough readable source text for downstream indexing and citation tests.
          The parser keeps this static page useful without requiring a browser
          fallback or a custom adapter for a plain documentation layout.
        </main>
      </body>
    </html>`;
}

function bodyHtml() {
  return `<!doctype html>
    <html>
      <head><title>Body Only</title></head>
      <body>
        The body fallback captures simple pages that do not use article
        landmarks but still publish helpful readable prose. This keeps basic
        documentation pages parseable without requiring a browser-rendered pass
        or a custom site adapter for every small public website.
      </body>
    </html>`;
}

function htmlFetch(html) {
  return responseFetch(html, {
    status: 200,
    contentType: "text/html; charset=utf-8",
  });
}

function responseFetch(body, { status, contentType }) {
  return async () =>
    new Response(body, {
      status,
      headers: {
        "content-type": contentType,
      },
    });
}

function quietLogger() {
  return {
    info() {},
    warn() {},
  };
}
