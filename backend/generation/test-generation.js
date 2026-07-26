import "dotenv/config";

import { searchChunks } from "../retrieval/index.js";
import { answerQuestion } from "./index.js";

const NOTEBOOK_ID =
  "11111111-1111-4111-8111-111111111111";

async function testGeneration() {
  const question =
    "What are the possible states of a Promise?";

  console.log("Question:", question);

  const retrievedChunks =
    await searchChunks({
      query: question,
      notebookId: NOTEBOOK_ID,
      limit: 3,
    });

  console.log(
    `Retrieved chunks: ${retrievedChunks.length}`
  );

  if (retrievedChunks.length === 0) {
    console.log(
      "No chunks were retrieved from Qdrant."
    );

    return;
  }

  const result = await answerQuestion({
    question,
    retrievedChunks,
  });

  console.log("\n========== ANSWER ==========");

  console.log(result.answer);

  console.log(
    "\n========== CITATIONS =========="
  );

  for (const citation of result.citations) {
    console.log({
      citationNumber:
        citation.citationNumber,

      sourceTitle:
        citation.sourceTitle,

      sourceType:
        citation.sourceType,

      chunkIndex:
        citation.chunkIndex,

      location:
        citation.location,

      score:
        citation.score,
    });
  }

  console.log(
    "\nModel:",
    result.model
  );
}

testGeneration().catch((error) => {
  console.error(
    "Generation test failed:",
    error
  );

  process.exit(1);
});