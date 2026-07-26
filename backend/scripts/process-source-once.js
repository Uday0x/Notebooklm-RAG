import "dotenv/config";

import { parseSource } from "../parser/index.js";
import { chunkSegments } from "../chunking/index.js";
import { embedChunks } from "../embeddings/index.js";
import { indexChunks, deleteSourceVectors } from "../indexing/index.js";
import { prisma } from "../db/index.js";

const sourceId = process.argv[2];

if (!sourceId) {
  console.error("Usage: node scripts/process-source-once.js <sourceId>");
  process.exit(1);
}

try {
  const source = await prisma.source.findUnique({
    where: {
      id: sourceId,
    },
  });

  if (!source) {
    throw new Error(`Source not found: ${sourceId}`);
  }

  await prisma.source.update({
    where: {
      id: source.id,
    },
    data: {
      status: "PROCESSING",
      errorMessage: null,
    },
  });

  await deleteSourceVectors({
    notebookId: source.notebookId,
    sourceId: source.id,
  });

  const parsedSource = await parseSource({
    sourceType: source.type,
    storagePath: source.storagePath,
    filePath: source.storagePath,
    title: source.title,
  });

  const chunks = chunkSegments(parsedSource.segments);
  const embeddedChunks = await embedChunks(chunks);

  await indexChunks({
    notebookId: source.notebookId,
    sourceId: source.id,
    sourceTitle: parsedSource.title || source.title,
    sourceType: source.type,
    embeddedChunks,
  });

  await prisma.source.update({
    where: {
      id: source.id,
    },
    data: {
      status: "READY",
      errorMessage: null,
    },
  });

  console.log(
    JSON.stringify(
      {
        sourceId: source.id,
        status: "READY",
        segmentCount: parsedSource.segments.length,
        chunkCount: chunks.length,
        firstSegments: parsedSource.segments.slice(0, 3).map((segment) => ({
          text: segment.text.slice(0, 180),
          textLength: segment.text.length,
          location: segment.location,
        })),
        firstChunks: chunks.slice(0, 3).map((chunk) => ({
          text: chunk.text.slice(0, 180),
          textLength: chunk.text.length,
          location: chunk.location,
        })),
      },
      null,
      2
    )
  );
} catch (error) {
  await prisma.source.update({
    where: {
      id: sourceId,
    },
    data: {
      status: "FAILED",
      errorMessage: error.message || "Unable to process source",
    },
  });

  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
