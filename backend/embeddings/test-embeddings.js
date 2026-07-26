import "dotenv/config";

import { embedChunks } from "./index.js";

const chunks = [
  {
    chunkIndex: 1,

    text:
      "A promise represents a future asynchronous result.",

    location: {
      start: {
        paragraphIndex: 1,
        startLine: 2,
        endLine: 2,
      },

      end: {
        paragraphIndex: 1,
        startLine: 2,
        endLine: 2,
      },
    },

    segmentCount: 1,
  },

  {
    chunkIndex: 2,

    text:
      "A promise can be pending, fulfilled, or rejected.",

    location: {
      start: {
        paragraphIndex: 2,
        startLine: 4,
        endLine: 4,
      },

      end: {
        paragraphIndex: 2,
        startLine: 4,
        endLine: 4,
      },
    },

    segmentCount: 1,
  },
];

async function testEmbeddings() {
  const embeddedChunks =
    await embedChunks(chunks);

  console.log(
    "Total embedded chunks:",
    embeddedChunks.length
  );

  for (const chunk of embeddedChunks) {
    console.log({
      chunkIndex: chunk.chunkIndex,
      text: chunk.text,
      vectorLength: chunk.vector.length,
      firstFiveValues: chunk.vector.slice(0, 5),
      embeddingModel: chunk.embeddingModel,
    });
  }
}

testEmbeddings().catch((error) => {
  console.error(
    "Embedding test failed:",
    error
  );

  process.exit(1);
});