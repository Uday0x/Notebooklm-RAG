import { chunkSegments } from "./index.js";

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

const chunks = chunkSegments(
  parsedResult.segments,
  {
    maxCharacters: 100,
    overlapSegments: 1,
  }
);

console.dir(chunks, {
  depth: null,
});