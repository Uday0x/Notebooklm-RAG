import { Router } from "express";

import {
  createNotebookController,
  deleteNotebookController,
  getAllNotebooksController,
  getNotebookByIdController,
  getNotebookStatsController,
  updateNotebookController,
} from "./notebook.controller.js";

export const notebookRouter = Router();

notebookRouter.post(
  "/",
  createNotebookController
);

notebookRouter.get(
  "/",
  getAllNotebooksController
);

notebookRouter.get(
  "/:notebookId",
  getNotebookByIdController
);

notebookRouter.get(
  "/:notebookId/stats",
  getNotebookStatsController
);

notebookRouter.patch(
  "/:notebookId",
  updateNotebookController
);

notebookRouter.delete(
  "/:notebookId",
  deleteNotebookController
);
