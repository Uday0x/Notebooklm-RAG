import { Router } from "express";

import {
  createConversationController,
  deleteConversationController,
  getConversationByIdController,
  getNotebookConversationsController,
  updateConversationController,
} from "./conversation.controller.js";

export const conversationRouter =
  Router();

conversationRouter.post(
  "/notebooks/:notebookId/conversations",
  createConversationController
);

conversationRouter.get(
  "/notebooks/:notebookId/conversations",
  getNotebookConversationsController
);

conversationRouter.get(
  "/conversations/:conversationId",
  getConversationByIdController
);

conversationRouter.patch(
  "/conversations/:conversationId",
  updateConversationController
);

conversationRouter.delete(
  "/conversations/:conversationId",
  deleteConversationController
);