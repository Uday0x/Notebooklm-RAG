export function buildPrompt({
  question,
  retrievedChunks,
  conversationHistory = [],
}) {
  if (
    typeof question !== "string" ||
    !question.trim()
  ) {
    throw new Error(
      "buildPrompt requires a non-empty question"
    );
  }

  if (!Array.isArray(retrievedChunks)) {
    throw new Error(
      "retrievedChunks must be an array"
    );
  }

  if (!Array.isArray(conversationHistory)) {
    throw new Error(
      "conversationHistory must be an array"
    );
  }

  const formattedHistory =
    conversationHistory.length > 0
      ? conversationHistory
          .map((message) => {
            const role =
              message.role === "USER"
                ? "User"
                : "Assistant";

            return `${role}: ${message.content}`;
          })
          .join("\n")
      : "No previous conversation.";

  const formattedSources =
    retrievedChunks.length > 0
      ? retrievedChunks
          .map((chunk, index) => {
            const sourceTitle =
              chunk.metadata?.sourceTitle ??
              "Untitled source";

            const location =
              JSON.stringify(
                chunk.metadata?.location ?? {}
              );

            return `
[${index + 1}]
Source: ${sourceTitle}
Location: ${location}
Content:
${chunk.text}
            `.trim();
          })
          .join("\n\n")
      : "No relevant source excerpts were retrieved.";

  return `
CONVERSATION HISTORY:
${formattedHistory}

SOURCE EXCERPTS:
${formattedSources}

CURRENT QUESTION:
${question}

INSTRUCTIONS:
- Use conversation history only to understand the current question.
- Base factual claims only on the supplied source excerpts.
- Do not treat previous assistant answers as factual sources.
- If the source excerpts do not contain the answer, clearly say so.
- Cite sources using [1], [2], or [1][2].
  `.trim();
}