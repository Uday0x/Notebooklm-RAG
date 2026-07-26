import {
  createMessage,
  getConversationForChat,
  getMessagesPage,
  touchConversation,
  getRecentMessages,
} from "./message.service.js";

import {
  updateConversationTitle,
} from "../conversations/conversation.service.js";

import {
  generateConversationTitle,
} from "../../conversation-title/generateConversationTitle.js";

import {
  searchChunks,
} from "../../retrieval/index.js";

import {
  answerQuestion,
  answerQuestionStream,
} from "../../generation/index.js";

import {
  rewriteQuery,
} from "../../query-rewrite/index.js";

import {
  DEFAULT_MESSAGE_PAGE_LIMIT,
  DEFAULT_RETRIEVAL_LIMIT,
  MAX_MESSAGE_PAGE_LIMIT,
  MAX_RETRIEVAL_LIMIT,
} from "../../config/index.js";


export async function getConversationMessagesController(
  request,
  response
) {
  try {
    const { conversationId } =
      request.params;

    const parsedLimit =
      request.query.limit === undefined
        ? DEFAULT_MESSAGE_PAGE_LIMIT
        : Number(request.query.limit);

    if (
      !Number.isInteger(parsedLimit) ||
      parsedLimit <= 0 ||
      parsedLimit >
        MAX_MESSAGE_PAGE_LIMIT
    ) {
      return response.status(400).json({
        success: false,
        message: `limit must be an integer between 1 and ${MAX_MESSAGE_PAGE_LIMIT}`,
      });
    }

    const cursor =
      typeof request.query.cursor ===
        "string" &&
      request.query.cursor.trim()
        ? request.query.cursor.trim()
        : null;

    const conversation =
      await getConversationForChat(
        conversationId
      );

    if (!conversation) {
      return response.status(404).json({
        success: false,
        message:
          "Conversation not found",
      });
    }

    const page =
      await getMessagesPage({
        conversationId,
        limit: parsedLimit,
        cursor,
      });

    return response.status(200).json({
      success: true,
      data: page,
    });
  } catch (error) {
    console.error(
      "Get conversation messages failed:",
      error
    );

    return response.status(500).json({
      success: false,
      message:
        "Unable to fetch conversation messages",
    });
  }
}

export async function createMessageController(
  request,
  response
) {
  try {
    const { conversationId } =
      request.params;

    const {
      content,
      sourceIds = [],
      limit = DEFAULT_RETRIEVAL_LIMIT,
    } = request.body;

    // 1. Validate question
    if (
      typeof content !== "string" ||
      !content.trim()
    ) {
      return response.status(400).json({
        success: false,
        message:
          "Message content is required",
      });
    }

    if (!Array.isArray(sourceIds)) {
      return response.status(400).json({
        success: false,
        message:
          "sourceIds must be an array",
      });
    }

    const parsedLimit = Number(limit);

    if (
      !Number.isInteger(parsedLimit) ||
      parsedLimit <= 0 ||
      parsedLimit > MAX_RETRIEVAL_LIMIT
    ) {
      return response.status(400).json({
        success: false,
        message:
          `limit must be an integer between 1 and ${MAX_RETRIEVAL_LIMIT}`,
      });
    }

    // 2. Verify conversation and notebook
    const conversation =
      await getConversationForChat(
        conversationId
      );

    if (!conversation) {
      return response.status(404).json({
        success: false,
        message:
          "Conversation not found",
      });
    }

    const notebookId =
      conversation.notebookId;

    const readySources =
      conversation.notebook.sources;

    if (readySources.length === 0) {
      return response.status(409).json({
        success: false,
        message:
          "This notebook has no READY sources",
      });
    }

    // 3. Verify selected source IDs
    if (sourceIds.length > 0) {
      const readySourceIdSet = new Set(
        readySources.map(
          (source) => source.id
        )
      );

      const invalidSourceIds =
        sourceIds.filter(
          (sourceId) =>
            !readySourceIdSet.has(sourceId)
        );

      if (invalidSourceIds.length > 0) {
        return response.status(400).json({
          success: false,
          message:
            "Some selected sources are not READY or do not belong to this notebook",
          invalidSourceIds,
        });
      }
    }

    const question = content.trim();

    // 4. Load conversation memory before
    // query rewriting and prompt generation.
    const conversationHistory =
      await getRecentMessages({
        conversationId,
        limit: 10,
      });

    const isFirstMessage =
      conversationHistory.length === 0;

    const currentTitle =
      typeof conversation.title === "string"
        ? conversation.title.trim()
        : "";

    const hasDefaultTitle =
      !currentTitle ||
      currentTitle === "New Conversation" ||
      currentTitle === "New conversation";

    let resolvedConversationTitle =
      currentTitle || "New Conversation";

    if (
      isFirstMessage &&
      hasDefaultTitle
    ) {
      const conversationTitle =
        await generateConversationTitle({
          question,
        });

      await updateConversationTitle({
        conversationId,
        title: conversationTitle,
      });

      resolvedConversationTitle =
        conversationTitle;
    }

    // 5. Rewrite follow-up question into a
    // standalone retrieval query.
    const searchQuery =
      await rewriteQuery({
        question,
        conversationHistory,
      });

    // 6. Save the original USER message.
    const userMessage =
      await createMessage({
        conversationId,
        role: "USER",
        content: question,
      });

    // 7. Search Qdrant using the rewritten query.
    const retrievedChunks =
      await searchChunks({
        query: searchQuery,
        notebookId,
        sourceIds,
        limit: parsedLimit,
      });

    const retrieval = {
      originalQuery: question,
      searchQuery,

      resultCount:
        retrievedChunks.length,

      sourceIds:
        sourceIds.length > 0
          ? sourceIds
          : readySources.map(
              (source) => source.id
            ),
    };

    if (clientWantsSse(request)) {
      const streamAbortController =
        new AbortController();
      let clientDisconnected = false;

      request.on("close", () => {
        clientDisconnected = true;
        streamAbortController.abort();
      });

      prepareSseResponse(response);
      writeSseEvent(response, "metadata", {
        conversationId,
        conversationTitle:
          resolvedConversationTitle,
        originalQuery: question,
        searchQuery,
        resultCount:
          retrievedChunks.length,
      });

      try {
        const generationResult =
          await answerQuestionStream({
            question,
            retrievedChunks,
            conversationHistory,
            signal:
              streamAbortController.signal,
            onToken: (token) => {
              writeSseEvent(response, "token", {
                content: token,
              });
            },
          });

        if (clientDisconnected) {
          return;
        }

        const assistantMessage =
          await createMessage({
            conversationId,
            role: "ASSISTANT",
            content:
              generationResult.answer,
          });

        await touchConversation(
          conversationId
        );

        writeSseEvent(response, "complete", {
          assistantMessage,
          answer:
            generationResult.answer,
          citations:
            generationResult.citations,
          model:
            generationResult.model,
        });

        return endSseResponse(response);
      } catch (error) {
        if (clientDisconnected) {
          return;
        }

        console.error(
          "Stream chat message failed:",
          error
        );

        writeSseError(response, {
          message:
            "Unable to process the message",
        });

        return endSseResponse(response);
      }
    }

    // 8. Generate answer using original question,
    // retrieved sources, and chat history.
    const generationResult =
      await answerQuestion({
        question,
        retrievedChunks,
        conversationHistory,
      });

    // 9. Save ASSISTANT response.
    const assistantMessage =
      await createMessage({
        conversationId,
        role: "ASSISTANT",
        content:
          generationResult.answer,
      });

    // 10. Update conversation timestamp.
    await touchConversation(
      conversationId
    );

    return response.status(201).json({
      success: true,

      data: {
        userMessage,
        assistantMessage,

        answer:
          generationResult.answer,

        citations:
          generationResult.citations,

        model:
          generationResult.model,

        retrieval,
      },
    });
  } catch (error) {
    console.error(
      "Create chat message failed:",
      error
    );

    if (response.headersSent) {
      writeSseError(response, {
        message:
          "Unable to process the message",
      });

      return endSseResponse(response);
    }

    return response.status(500).json({
      success: false,
      message:
        "Unable to process the message",

      error:
        process.env.NODE_ENV ===
        "development"
          ? error.message
          : undefined,
    });
  }
}

/**
 * Detects whether the caller opted into Server Sent Events while keeping
 * normal JSON clients on the existing response contract.
 */
function clientWantsSse(request) {
  return request
    .get("accept")
    ?.includes("text/event-stream") === true;
}

/**
 * Sends the standard SSE headers and flushes them before model generation so
 * clients can start listening for token events immediately.
 */
function prepareSseResponse(response) {
  response.status(201);
  response.setHeader(
    "Content-Type",
    "text/event-stream"
  );
  response.setHeader(
    "Cache-Control",
    "no-cache, no-transform"
  );
  response.setHeader(
    "Connection",
    "keep-alive"
  );
  response.setHeader(
    "X-Accel-Buffering",
    "no"
  );
  response.flushHeaders?.();
}

/**
 * Writes one named JSON SSE event.
 */
function writeSseEvent(response, eventName, payload) {
  if (
    response.writableEnded ||
    response.destroyed
  ) {
    return;
  }

  response.write(`event: ${eventName}\n`);
  response.write(
    `data: ${JSON.stringify(payload)}\n\n`
  );
}

/**
 * Writes an SSE error event after headers have already been sent, avoiding a
 * second JSON response on the same request.
 */
function writeSseError(response, payload) {
  if (
    response.writableEnded ||
    response.destroyed
  ) {
    return;
  }

  response.write("event: error\n");
  response.write(
    `data: ${JSON.stringify(payload)}\n\n`
  );
}

/**
 * Ends an SSE response only when the socket is still writable.
 */
function endSseResponse(response) {
  if (
    response.writableEnded ||
    response.destroyed
  ) {
    return;
  }

  return response.end();
}
