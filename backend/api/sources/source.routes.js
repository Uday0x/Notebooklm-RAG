import multer from "multer";
import { Router } from "express";

import {
  uploadSourceFile,
} from "../../storage/upload.middleware.js";

import {
  createSourceController,
  deleteSourceController,
  getNotebookSourcesController,
  getSourceByIdController,
  getSourceStatusController,
  updateSourceController,
  uploadSourceController,
} from "./source.controller.js";

export const sourceRouter = Router();

function handleSourceUpload(
  request,
  response,
  next
) {
  uploadSourceFile(
    request,
    response,
    (error) => {
      if (!error) {
        return next();
      }

      if (
        error instanceof
        multer.MulterError
      ) {
        if (
          error.code ===
          "LIMIT_FILE_SIZE"
        ) {
          return response
            .status(413)
            .json({
              success: false,
              message:
                "Uploaded file is too large",
            });
        }

        return response
          .status(400)
          .json({
            success: false,
            message: error.message,
          });
      }

      return response
        .status(400)
        .json({
          success: false,
          message:
            error.message ??
            "Invalid file upload",
        });
    }
  );
}

sourceRouter.post(
  "/notebooks/:notebookId/sources/upload",
  handleSourceUpload,
  uploadSourceController
);


sourceRouter.post(
  "/notebooks/:notebookId/sources",
  createSourceController
);

sourceRouter.get(
  "/notebooks/:notebookId/sources",
  getNotebookSourcesController
);

sourceRouter.get(
  "/sources/:sourceId",
  getSourceByIdController
);

sourceRouter.get(
  "/sources/:sourceId/status",
  getSourceStatusController
);

sourceRouter.patch(
  "/sources/:sourceId",
  updateSourceController
);

sourceRouter.delete(
  "/sources/:sourceId",
  deleteSourceController
);
