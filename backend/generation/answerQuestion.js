import { generationClient } from "./generation.client.js";
import { buildPrompt } from "./buildPrompt.js";
import { config } from "../config/index.js";

const ANSWER_INSTRUCTIONS = `
You are a document-grounded question-answering assistant.

Answer only from the supplied sources.
Never invent information or citations.
Use inline citations such as [1] or [1][2].
`.trim();

const NO_SOURCE_ANSWER =
  "The provided sources do not contain enough information to answer this.";

/**
 * Flow:
 * Question + retrieved chunks
 * → grounded prompt
 * → OpenAI response
 * → answer and structured citations
 */
export async function answerQuestion({
  question,
  retrievedChunks,
  conversationHistory = [],
}) {
  if (
    typeof question !== "string" ||
    !question.trim()
  ) {
    throw new Error(
      "answerQuestion requires a non-empty question"
    );
  }

  if (
    !Array.isArray(retrievedChunks) ||
    retrievedChunks.length === 0
  ) {
    return {
      answer:
        NO_SOURCE_ANSWER,

      citations: [],
      model: null,
    };
  }

  const prompt = buildPrompt({
    question,
    retrievedChunks,
    conversationHistory,
  });

  const response =
    await generationClient.responses.create({
      model: config.generationModel,

      instructions: ANSWER_INSTRUCTIONS,

      input: prompt,
    });

  const answer = response.output_text?.trim();

  if (!answer) {
    throw new Error(
      "Generation model returned an empty answer"
    );
  }

  const citationNumbers =
    extractCitationNumbers(answer);

  const citations = citationNumbers
    .map((citationNumber) =>
      createCitationFromChunk({
        citationNumber,
        chunk:
          retrievedChunks[citationNumber - 1],
      })
    )
    .filter(Boolean);

  return {
    answer,
    citations,
    model: config.generationModel,
  };
}

/**
 * Streams a grounded answer from OpenAI while reusing the same prompt,
 * model, fallback answer, and citation extraction as answerQuestion.
 * The onToken callback keeps transport details outside the generation module.
 */
export async function answerQuestionStream({
  question,
  retrievedChunks,
  conversationHistory = [],
  onToken,
  signal,
}) {
  if (
    typeof question !== "string" ||
    !question.trim()
  ) {
    throw new Error(
      "answerQuestionStream requires a non-empty question"
    );
  }

  if (typeof onToken !== "function") {
    throw new Error(
      "answerQuestionStream requires an onToken function"
    );
  }

  if (
    !Array.isArray(retrievedChunks) ||
    retrievedChunks.length === 0
  ) {
    await onToken(NO_SOURCE_ANSWER);

    return {
      answer: NO_SOURCE_ANSWER,
      citations: [],
      model: null,
    };
  }

  const prompt = buildPrompt({
    question,
    retrievedChunks,
    conversationHistory,
  });

  const stream =
    await generationClient.responses.create(
      {
        model: config.generationModel,
        instructions: ANSWER_INSTRUCTIONS,
        input: prompt,
        stream: true,
      },
      {
        signal,
      }
    );

  let answer = "";

  for await (const event of stream) {
    if (
      event.type !==
        "response.output_text.delta" ||
      typeof event.delta !== "string" ||
      !event.delta
    ) {
      continue;
    }

    answer += event.delta;
    await onToken(event.delta);
  }

  answer = answer.trim();

  if (!answer) {
    throw new Error(
      "Generation model returned an empty answer"
    );
  }

  const citationNumbers =
    extractCitationNumbers(answer);

  const citations = citationNumbers
    .map((citationNumber) =>
      createCitationFromChunk({
        citationNumber,
        chunk:
          retrievedChunks[citationNumber - 1],
      })
    )
    .filter(Boolean);

  return {
    answer,
    citations,
    model: config.generationModel,
  };
}

/**
 * Finds citations such as:
 *
 * [1]
 * [2]
 * [1][3]
 * [1, 2]
 */
function extractCitationNumbers(answer) {
  const citationNumbers = new Set();

  const citationGroups =
    answer.match(/\[(?:\d+\s*,?\s*)+\]/g) ?? [];

  for (const group of citationGroups) {
    const numbers =
      group.match(/\d+/g) ?? [];

    for (const value of numbers) {
      citationNumbers.add(Number(value));
    }
  }

  return [...citationNumbers].sort(
    (first, second) => first - second
  );
}

/**
 * Converts one retrieved chunk into the citation response shape shared by
 * JSON and SSE responses.
 */
function createCitationFromChunk({
  citationNumber,
  chunk,
}) {
  if (!chunk) {
    return null;
  }

  return {
    citationNumber,

    sourceId:
      chunk.metadata?.sourceId ?? null,

    sourceTitle:
      chunk.metadata?.sourceTitle ??
      "Untitled source",

    sourceType:
      chunk.metadata?.sourceType ??
      "UNKNOWN",

    chunkIndex:
      chunk.metadata?.chunkIndex ?? null,

    location:
      normalizeCitationLocation(
        chunk.metadata?.location,
        chunk.metadata?.sourceType
      ),

    score:
      chunk.score ?? null,

    text: chunk.text,
  };
}

function normalizeCitationLocation(location = {}, sourceType) {
  const fields = location && typeof location === "object" ? location : {};
  const type = String(sourceType ?? "").toUpperCase();

  if (type === "PDF") {
    const start = fields.pageStart ?? fields.pageNumber ?? fields.page ?? fields.start?.pageNumber ?? fields.start?.page;
    const end = fields.pageEnd ?? fields.end?.pageNumber ?? fields.end?.page ?? start;

    if (start || end) {
      return {
        pageStart: Number(start ?? end),
        pageEnd: Number(end ?? start),
        ...(fields.totalPages !== undefined && {
          totalPages: fields.totalPages,
        }),
      };
    }
  }

  return fields;
}
