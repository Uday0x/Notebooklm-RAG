import test from "node:test";
import assert from "node:assert/strict";

import {
  cleanPdfPageText,
  isMeaningfulPdfText,
  parsePdf,
  PdfParserError,
} from "../parser/pdf/parsePdf.js";
import { chunkSegments } from "../chunking/index.js";

test("text-based PDF page returns actual extracted content", async () => {
  const result = await parsePdf({
    buffer: Buffer.from("fake"),
    title: "HCI Notes",
    pdfParserFactory: fakePdfParserFactory({
      total: 1,
      pages: {
        1: `
          UNIT 2
          -- 1 of 20 --

          Human computer interaction studies how people perceive, remember,
          learn, and make decisions while using interactive systems.
        `,
      },
    }),
    logger: quietLogger(),
  });

  assert.equal(result.sourceType, "PDF");
  assert.match(result.segments[0].text, /Human computer interaction/);
  assert.doesNotMatch(result.segments[0].text, /-- 1 of 20 --/);
  assert.deepEqual(result.segments[0].location, {
    pageNumber: 1,
    pageStart: 1,
    pageEnd: 1,
    totalPages: 1,
    paragraphIndex: 1,
  });
});

test("PDF page markers are not kept as segment text", () => {
  const cleaned = cleanPdfPageText(`
    UNIT 2
    -- 1 of 20 --
    Page 3
    Interaction design requires clear navigation and meaningful organisation
    so users can complete tasks with less cognitive effort.
  `);

  assert.doesNotMatch(cleaned, /UNIT 2/);
  assert.doesNotMatch(cleaned, /1 of 20/);
  assert.doesNotMatch(cleaned, /Page 3/);
  assert.match(cleaned, /Interaction design/);
});

test("marker-only PDF text is rejected", () => {
  assert.equal(isMeaningfulPdfText("UNIT 2\n-- 1 of 20 --\n-- 2 of 20 --"), false);
});

test("empty or scanned PDF fails with a friendly permanent error", async () => {
  await assert.rejects(
    parsePdf({
      buffer: Buffer.from("fake"),
      pdfParserFactory: fakePdfParserFactory({
        total: 2,
        pages: {
          1: "-- 1 of 20 --",
          2: " ",
        },
      }),
      logger: quietLogger(),
    }),
    (error) =>
      error instanceof PdfParserError &&
      error.permanent === true &&
      /OCR is not currently enabled/.test(error.message),
  );
});

test("PDF chunk text contains content and metadata contains page range", () => {
  const chunks = chunkSegments(
    [
      {
        text: "Human factors shape interface design by accounting for perception and memory.",
        location: {
          pageNumber: 3,
          pageStart: 3,
          pageEnd: 3,
          totalPages: 20,
        },
      },
      {
        text: "Design goals reduce visual, intellectual, and motor effort for users.",
        location: {
          pageNumber: 4,
          pageStart: 4,
          pageEnd: 4,
          totalPages: 20,
        },
      },
    ],
    {
      maxCharacters: 1000,
      overlapSegments: 0,
    },
  );

  assert.match(chunks[0].text, /Human factors/);
  assert.doesNotMatch(chunks[0].text, /1 of 20/);
  assert.equal(chunks[0].location.pageStart, 3);
  assert.equal(chunks[0].location.pageEnd, 4);
  assert.equal(chunks[0].location.totalPages, 20);
});

function fakePdfParserFactory({ total, pages }) {
  return () => ({
    getInfo: async () => ({
      total,
      infoData: {
        Title: "Fixture PDF",
      },
    }),
    getText: async ({ partial }) => ({
      text: pages[partial[0]] ?? "",
    }),
    destroy: async () => {},
  });
}

function quietLogger() {
  return {
    debug() {},
  };
}
