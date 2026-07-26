import "dotenv/config";

import { chunkSegments } from "../chunking/index.js";
import { embedChunks } from "../embeddings/index.js";
import { indexChunks } from "./index.js";

const parsedResult = {
  title: "Promise Notes",

  sourceType: "TEXT",

  segments: [
    {
      text:
        "A promise represents a future asynchronous result.",

      location: {
        paragraphIndex: 1,
        startLine: 2,
        endLine: 2,
      },
    },

    {
      text:
        "A promise can be pending, fulfilled, or rejected.",

      location: {
        paragraphIndex: 2,
        startLine: 4,
        endLine: 4,
      },
    },

    {
      text:
        "The then method handles successful results.",

      location: {
        paragraphIndex: 3,
        startLine: 6,
        endLine: 6,
      },
    },
  ],
};

async function testIndexing() {
  const chunks = chunkSegments(
    parsedResult.segments,
    {
      maxCharacters: 100,
      overlapSegments: 1,
    }
  );

  console.log(
    `Chunks created: ${chunks.length}`
  );

  const embeddedChunks =
    await embedChunks(chunks);

  console.log(
    `Chunks embedded: ${embeddedChunks.length}`
  );

  const result = await indexChunks({
    notebookId:
      "11111111-1111-4111-8111-111111111111",

    sourceId:
      "22222222-2222-4222-8222-222222222222",

    sourceTitle: parsedResult.title,
    sourceType: parsedResult.sourceType,
    embeddedChunks,
  });

  console.log(
    "Indexing successful:",
    result
  );
}

testIndexing().catch((error) => {
  console.error(
    "Indexing test failed:",
    error
  );

  process.exit(1);
});