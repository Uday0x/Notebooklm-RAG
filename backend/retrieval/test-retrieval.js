import "dotenv/config";

import { searchChunks } from "./index.js";

async function testRetrieval() {
  const results = await searchChunks({
    query: "What are the possible states of a promise?",

    notebookId:
      "11111111-1111-4111-8111-111111111111",

    limit: 3,
  });

  console.log(`Retrieved chunks: ${results.length}`);

  for (const result of results) {
    console.log("\n-------------------------");

    console.log({
      rank: result.rank,
      score: result.score,
      sourceTitle: result.metadata.sourceTitle,
      chunkIndex: result.metadata.chunkIndex,
      location: result.metadata.location,
    });

    console.log("Text:", result.text);
  }
}

testRetrieval().catch((error) => {
  console.error("Retrieval test failed:", error);
  process.exit(1);
});