import {
  createConversation,
  deleteConversation,
  getConversationById,
  getConversationsByNotebookId,
  updateConversation,
} from "./conversation.service.js";

import {
  getNotebookById,
} from "../notebooks/notebook.service.js";

import {
  MAX_CONVERSATION_TITLE_LENGTH,
} from "../../config/index.js";

export async function createConversationController(
  request,
  response
) {
  try {
    const { notebookId } = request.params;
    const { title } = request.body;

    const notebook =
      await getNotebookById(notebookId);

    if (!notebook) {
      return response.status(404).json({
        success: false,
        message: "Notebook not found",
      });
    }

    if (
      title !== undefined &&
      (
        typeof title !== "string" ||
        !title.trim() ||
        title.trim().length >
          MAX_CONVERSATION_TITLE_LENGTH
      )
    ) {
      return response.status(400).json({
        success: false,
        message:
          `Conversation title must be 1-${MAX_CONVERSATION_TITLE_LENGTH} characters`,
      });
    }

    const conversation =
      await createConversation({
        notebookId,

        title:
          typeof title === "string"
            ? title.trim()
            : "New conversation",
      });

    return response.status(201).json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    console.error(
      "Create conversation failed:",
      error
    );

    return response.status(500).json({
      success: false,
      message:
        "Unable to create conversation",
    });
  }
}

export async function getNotebookConversationsController(
  request,
  response
) {
  try {
    const { notebookId } = request.params;

    const notebook =
      await getNotebookById(notebookId);

    if (!notebook) {
      return response.status(404).json({
        success: false,
        message: "Notebook not found",
      });
    }

    const conversations =
      await getConversationsByNotebookId(
        notebookId
      );

    return response.status(200).json({
      success: true,
      data: conversations,
    });
  } catch (error) {
    console.error(
      "Get conversations failed:",
      error
    );

    return response.status(500).json({
      success: false,
      message:
        "Unable to fetch conversations",
    });
  }
}

export async function getConversationByIdController(
  request,
  response
) {
  try {
    const { conversationId } =
      request.params;

    const conversation =
      await getConversationById(
        conversationId
      );

    if (!conversation) {
      return response.status(404).json({
        success: false,
        message: "Conversation not found",
      });
    }

    return response.status(200).json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    console.error(
      "Get conversation failed:",
      error
    );

    return response.status(500).json({
      success: false,
      message:
        "Unable to fetch conversation",
    });
  }
}

export async function updateConversationController(
  request,
  response
) {
  try {
    const { conversationId } =
      request.params;

    const { title } = request.body;

    if (
      typeof title !== "string" ||
      !title.trim() ||
      title.trim().length >
        MAX_CONVERSATION_TITLE_LENGTH
    ) {
      return response.status(400).json({
        success: false,
        message:
          `Conversation title must be 1-${MAX_CONVERSATION_TITLE_LENGTH} characters`,
      });
    }

    const existingConversation =
      await getConversationById(
        conversationId
      );

    if (!existingConversation) {
      return response.status(404).json({
        success: false,
        message: "Conversation not found",
      });
    }

    const conversation =
      await updateConversation(
        conversationId,
        {
          title: title.trim(),
        }
      );

    return response.status(200).json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    console.error(
      "Update conversation failed:",
      error
    );

    return response.status(500).json({
      success: false,
      message:
        "Unable to update conversation",
    });
  }
}

export async function deleteConversationController(
  request,
  response
) {
  try {
    const { conversationId } =
      request.params;

    const existingConversation =
      await getConversationById(
        conversationId
      );

    if (!existingConversation) {
      return response.status(404).json({
        success: false,
        message: "Conversation not found",
      });
    }

    await deleteConversation(
      conversationId
    );

    return response.status(200).json({
      success: true,
      message:
        "Conversation deleted successfully",
    });
  } catch (error) {
    console.error(
      "Delete conversation failed:",
      error
    );

    return response.status(500).json({
      success: false,
      message:
        "Unable to delete conversation",
    });
  }
}
