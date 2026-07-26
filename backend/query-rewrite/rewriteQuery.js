import {
  queryRewriteClient,
} from "./queryRewrite.client.js";

const QUERY_REWRITE_MODEL =
  process.env.QUERY_REWRITE_MODEL ??
  "gpt-4.1-mini";

export async function rewriteQuery({
  question,
  conversationHistory = [],
}) {
  if (
    typeof question !== "string" ||
    !question.trim()
  ) {
    throw new Error(
      "rewriteQuery requires a non-empty question"
    );
  }

  if (
    !Array.isArray(conversationHistory)
  ) {
    throw new Error(
      "conversationHistory must be an array"
    );
  }

  // First question hai toh rewrite ki zarurat nahi.
  if (conversationHistory.length === 0) {
    return question.trim();
  }

  const formattedHistory =
    conversationHistory
      .map((message) => {
        const role =
          message.role === "USER"
            ? "User"
            : "Assistant";

        return `${role}: ${message.content}`;
      })
      .join("\n");

  const response =
    await queryRewriteClient.responses.create({
      model: QUERY_REWRITE_MODEL,

      instructions: `
You rewrite follow-up questions into standalone document-search queries.

Use the conversation history only to resolve references such as:
- it
- this
- that
- they
- them
- the previous concept
- the above topic

Rules:
- Return only the rewritten query.
- Do not answer the question.
- Do not add explanations.
- Preserve the user's intent.
- Keep the query concise.
- Do not invent information.
      `.trim(),

      input: `
CONVERSATION HISTORY:
${formattedHistory}

CURRENT QUESTION:
${question.trim()}

STANDALONE SEARCH QUERY:
      `.trim(),
    });

  const rewrittenQuery =
    response.output_text?.trim();

  if (!rewrittenQuery) {
    return question.trim();
  }

  return rewrittenQuery;
}