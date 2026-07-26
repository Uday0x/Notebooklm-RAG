import {
  parseSource,
  SOURCE_TYPES,
} from "./index.js";

async function testTextParser() {
  const result = await parseSource({
    sourceType: SOURCE_TYPES.TEXT,
    title: "Promise Notes",
    content: `
A promise represents a future asynchronous result.

A promise can be pending, fulfilled, or rejected.

The then method handles successful results.
    `,
  });

  console.dir(result, {
    depth: null,
  });
}

testTextParser().catch((error) => {
  console.error(error);
  process.exit(1);
});