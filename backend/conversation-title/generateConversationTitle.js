import {
  conversationTitleClient,
} from "./conversationTitle.client.js";

const CONVERSATION_TITLE_MODEL =
  process.env.CONVERSATION_TITLE_MODEL ??
  "gpt-4.1-mini";

const MAX_TITLE_LENGTH = 80;

export async function generateConversationTitle({
  question,
}) {
  if (
    typeof question !== "string" ||
    !question.trim()
  ) {
    throw new Error(
      "generateConversationTitle requires a non-empty question"
    );
  }

  const fallbackTitle =
    createFallbackTitle(question);

  try {
    const response =
      await conversationTitleClient.responses.create({
        model: CONVERSATION_TITLE_MODEL,

        instructions: `
Generate a short title for a chat conversation.

Rules:
- Return only the title.
- Use 3 to 7 words.
- Do not use quotation marks.
- Do not use a full stop at the end.
- Preserve important technical terms.
- Do not answer the user's question.
- Keep the title clear and specific.
        `.trim(),

        input: question.trim(),
      });

    const generatedTitle =
      cleanTitle(response.output_text);

    if (!generatedTitle) {
      return fallbackTitle;
    }

    return generatedTitle.slice(
      0,
      MAX_TITLE_LENGTH
    );
  } catch (error) {
    console.error(
      "Conversation title generation failed:",
      error
    );

    // Chat should still work even if
    // title generation fails.
    return fallbackTitle;
  }
}

function cleanTitle(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .trim()
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/\.$/, "")
    .replace(/\s+/g, " ");
}

function createFallbackTitle(question) {
  const cleanedQuestion = question
    .trim()
    .replace(/\s+/g, " ");

  if (
    cleanedQuestion.length <=
    MAX_TITLE_LENGTH
  ) {
    return cleanedQuestion;
  }

  return `${cleanedQuestion.slice(
    0,
    MAX_TITLE_LENGTH - 3
  )}...`;
}