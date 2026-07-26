import { Router } from "express";

import {
  createMessageController,
  getConversationMessagesController,
} from "./message.controller.js";

export const messageRouter = Router();

messageRouter.post(
  "/conversations/:conversationId/messages",
  createMessageController
);

messageRouter.get(
  "/conversations/:conversationId/messages",
  getConversationMessagesController
);
