import {
  createSource,
  deleteSource,
  getSourceById,
  getSourcesByNotebookId,
  updateSource,
} from "./source.service.js";

import {
  getNotebookById,
} from "../notebooks/notebook.service.js";

import fs from "fs/promises";
import path from "path";

import {
  addSourceProcessingJob,
  getSourceProcessingJobStatus,
} from "../../queues/index.js";

import {
  deleteSourceVectors,
} from "../../indexing/index.js";

import {
  deleteStoredFile,
} from "../../storage/deleteStoredFile.js";

const ALLOWED_SOURCE_TYPES = [
  "PDF",
  "DOCX",
  "WEBSITE",
  "YOUTUBE",
  "TEXT",
  "VTT",
];

const ALLOWED_SOURCE_STATUSES = [
  "PENDING",
  "PROCESSING",
  "READY",
  "FAILED",
];

export async function createSourceController(
  request,
  response
) {
  try {
    const { notebookId } = request.params;

    const {
      title,
      type,
      content,
      text,
      url,
      originalFileName,
      storagePath,
    } = request.body;

    if (
      typeof title !== "string" ||
      !title.trim()
    ) {
      return response.status(400).json({
        success: false,
        message: "Source title is required",
      });
    }

    if (
      typeof type !== "string" ||
      !ALLOWED_SOURCE_TYPES.includes(
        type.toUpperCase()
      )
    ) {
      return response.status(400).json({
        success: false,
        message:
          "Invalid source type",
        allowedTypes: ALLOWED_SOURCE_TYPES,
      });
    }

    const notebook =
      await getNotebookById(notebookId);

    if (!notebook) {
      return response.status(404).json({
        success: false,
        message: "Notebook not found",
      });
    }

    const normalizedType =
      type.toUpperCase();

    const sourceContent =
      typeof content === "string"
        ? content.trim()
        : typeof text === "string"
          ? text.trim()
          : "";

    const sourceUrl =
      typeof url === "string"
        ? url.trim()
        : "";

    if (
      normalizedType === "TEXT" &&
      !sourceContent
    ) {
      return response.status(400).json({
        success: false,
        message:
          "Text source content is required",
      });
    }

    if (
      (
        normalizedType === "WEBSITE" ||
        normalizedType === "YOUTUBE"
      ) &&
      !isValidHttpUrl(sourceUrl)
    ) {
      return response.status(400).json({
        success: false,
        message:
          "A valid http(s) URL is required",
      });
    }

    if (
      ["PDF", "DOCX", "VTT"].includes(
        normalizedType
      ) &&
      !storagePath
    ) {
      return response.status(400).json({
        success: false,
        message:
          "File-based sources must be uploaded with the upload endpoint",
      });
    }

    const source = await createSource({
      notebookId,

      title: title.trim(),

      type: normalizedType,

      originalFileName:
        typeof originalFileName === "string"
          ? originalFileName.trim()
          : undefined,

      storagePath:
        typeof storagePath === "string"
          ? storagePath.trim()
          : undefined,
    });

    const job =
      await addSourceProcessingJob({
        sourceId: source.id,
        notebookId: source.notebookId,
        sourceType: source.type,
        storagePath: source.storagePath,
        title: source.title,
        content:
          normalizedType === "TEXT"
            ? sourceContent
            : undefined,
        url:
          normalizedType === "WEBSITE" ||
          normalizedType === "YOUTUBE"
            ? sourceUrl
            : undefined,
      });

    return response.status(202).json({
      success: true,
      message:
        "Source created and queued for processing",
      data: {
        source,
        job: {
          id: job.id,
          name: job.name,
        },
      },
    });
  } catch (error) {
    console.error(
      "Create source failed:",
      error
    );

    return response.status(500).json({
      success: false,
      message: "Unable to create source",
    });
  }
}

export async function getNotebookSourcesController(
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

    const sources =
      await getSourcesByNotebookId(
        notebookId
      );

    return response.status(200).json({
      success: true,
      data: sources,
    });
  } catch (error) {
    console.error(
      "Get notebook sources failed:",
      error
    );

    return response.status(500).json({
      success: false,
      message:
        "Unable to fetch notebook sources",
    });
  }
}

export async function getSourceByIdController(
  request,
  response
) {
  try {
    const { sourceId } = request.params;

    const source =
      await getSourceById(sourceId);

    if (!source) {
      return response.status(404).json({
        success: false,
        message: "Source not found",
      });
    }

    const processing =
      await getSourceProcessingJobStatus(
        sourceId
      );

    return response.status(200).json({
      success: true,
      data: formatSourceResponse(
        source,
        processing
      ),
    });
  } catch (error) {
    console.error(
      "Get source failed:",
      error
    );

    return response.status(500).json({
      success: false,
      message: "Unable to fetch source",
    });
  }
}

function isValidHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return (
      parsed.protocol === "http:" ||
      parsed.protocol === "https:"
    );
  } catch (error) {
    return false;
  }
}

export async function getSourceStatusController(
  request,
  response
) {
  try {
    const { sourceId } = request.params;

    const source =
      await getSourceById(sourceId);

    if (!source) {
      return response.status(404).json({
        success: false,
        message: "Source not found",
      });
    }

    const processing =
      await getSourceProcessingJobStatus(
        sourceId
      );

    return response.status(200).json({
      success: true,
      data: {
        sourceId: source.id,
        status: source.status,
        progress:
          typeof processing?.progress ===
          "number"
            ? processing.progress
            : null,
        error:
          source.errorMessage ?? null,
        updatedAt: source.updatedAt,
      },
    });
  } catch (error) {
    console.error(
      "Get source status failed:",
      error
    );

    return response.status(500).json({
      success: false,
      message:
        "Unable to fetch source status",
    });
  }
}

export async function updateSourceController(
  request,
  response
) {
  try {
    const { sourceId } = request.params;

    const {
      title,
      status,
      originalFileName,
      storagePath,
    } = request.body;

    if (
      title === undefined &&
      status === undefined &&
      originalFileName === undefined &&
      storagePath === undefined
    ) {
      return response.status(400).json({
        success: false,
        message:
          "Provide at least one field to update",
      });
    }

    if (
      title !== undefined &&
      (
        typeof title !== "string" ||
        !title.trim()
      )
    ) {
      return response.status(400).json({
        success: false,
        message:
          "Source title cannot be empty",
      });
    }

    const normalisedStatus =
      typeof status === "string"
        ? status.toUpperCase()
        : status;

    if (
      normalisedStatus !== undefined &&
      !ALLOWED_SOURCE_STATUSES.includes(
        normalisedStatus
      )
    ) {
      return response.status(400).json({
        success: false,
        message:
          "Invalid source status",
        allowedStatuses:
          ALLOWED_SOURCE_STATUSES,
      });
    }

    const existingSource =
      await getSourceById(sourceId);

    if (!existingSource) {
      return response.status(404).json({
        success: false,
        message: "Source not found",
      });
    }

    const source = await updateSource(
      sourceId,
      {
        title:
          typeof title === "string"
            ? title.trim()
            : undefined,

        status: normalisedStatus,

        originalFileName:
          typeof originalFileName ===
          "string"
            ? originalFileName.trim()
            : originalFileName,

        storagePath:
          typeof storagePath === "string"
            ? storagePath.trim()
            : storagePath,
      }
    );

    return response.status(200).json({
      success: true,
      data: source,
    });
  } catch (error) {
    console.error(
      "Update source failed:",
      error
    );

    return response.status(500).json({
      success: false,
      message: "Unable to update source",
    });
  }
}

export async function deleteSourceController(
  request,
  response
) {
  try {
    const { sourceId } = request.params;

    const existingSource =
      await getSourceById(sourceId);

    if (!existingSource) {
      return response.status(404).json({
        success: false,
        message: "Source not found",
      });
    }

    // 1. Qdrant vectors delete
    await deleteSourceVectors({
      notebookId:
        existingSource.notebookId,
      sourceId,
    });

    // 2. Local file delete
    await deleteStoredFile(
      existingSource.storagePath
    );

    // 3. PostgreSQL record delete
    await deleteSource(sourceId);

    return response.status(200).json({
      success: true,
      message:
        "Source and related data deleted successfully",
    });
  } catch (error) {
    console.error(
      "Delete source failed:",
      error
    );

    return response.status(500).json({
      success: false,
      message:
        "Unable to completely delete source",
      error:
        process.env.NODE_ENV ===
        "development"
          ? error.message
          : undefined,
    });
  }
}


function getSourceTypeFromFile(file) {
  const extension = path
    .extname(file.originalname)
    .toLowerCase();

  const typeMap = {
    ".pdf": "PDF",
    ".docx": "DOCX",
    ".txt": "TEXT",
    ".vtt": "VTT",
  };

  return typeMap[extension];
}

async function safelyDeleteFile(filePath) {
  if (!filePath) {
    return;
  }

  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error(
        "Failed to remove uploaded file:",
        error
      );
    }
  }
}

export async function uploadSourceController(
  request,
  response
) {
  let createdSource = null;

  try {
    const { notebookId } =
      request.params;

    const { title } = request.body;

    if (!request.file) {
      return response.status(400).json({
        success: false,
        message: "Source file is required",
      });
    }

    if (request.file.size === 0) {
      await safelyDeleteFile(
        request.file.path
      );

      return response.status(400).json({
        success: false,
        message:
          "Uploaded file cannot be empty",
      });
    }

    const notebook =
      await getNotebookById(notebookId);

    if (!notebook) {
      await safelyDeleteFile(
        request.file.path
      );

      return response.status(404).json({
        success: false,
        message: "Notebook not found",
      });
    }

    const sourceType =
      getSourceTypeFromFile(
        request.file
      );

    if (!sourceType) {
      await safelyDeleteFile(
        request.file.path
      );

      return response.status(400).json({
        success: false,
        message:
          "Unable to determine source type",
      });
    }

    const sourceTitle =
      typeof title === "string" &&
      title.trim()
        ? title.trim()
        : path.parse(
            request.file.originalname
          ).name;

    createdSource =
      await createSource({
        notebookId,
        title: sourceTitle,
        type: sourceType,

        originalFileName:
          request.file.originalname,

        storagePath:
          request.file.path,
      });

    const job =
      await addSourceProcessingJob({
        sourceId: createdSource.id,
        notebookId:
          createdSource.notebookId,
        sourceType:
          createdSource.type,
        storagePath:
          createdSource.storagePath,
        title: createdSource.title,
      });

    return response.status(202).json({
      success: true,

      message:
        "Source uploaded and queued for processing",

      data: {
        source: createdSource,

        job: {
          id: job.id,
          name: job.name,
        },
      },
    });
  } catch (error) {
    console.error(
      "Upload source failed:",
      error
    );

    if (createdSource) {
      try {
        await updateSource(
          createdSource.id,
          {
            status: "FAILED",
          }
        );
      } catch (
        sourceUpdateError
      ) {
        console.error(
          "Failed to update source status:",
          sourceUpdateError
        );
      }
    } else if (request.file?.path) {
      await safelyDeleteFile(
        request.file.path
      );
    }

    return response.status(500).json({
      success: false,
      message:
        "Unable to upload and queue source",
    });
  }
}

function formatSourceResponse(
  source,
  processing = null
) {
  return {
    id: source.id,
    notebookId: source.notebookId,
    title: source.title,
    sourceType: source.type,
    type: source.type,
    status: source.status,
    error: source.errorMessage ?? null,
    originalFileName:
      source.originalFileName,
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
    notebook: source.notebook,
    processing:
      processing === null
        ? null
        : {
            jobId: processing.jobId,
            state: processing.state,
            progress:
              processing.progress,
            attemptsMade:
              processing.attemptsMade,
          },
  };
}
