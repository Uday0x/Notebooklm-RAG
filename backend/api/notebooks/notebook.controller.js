import {
  createNotebook,
  deleteNotebook,
  getAllNotebooks,
  getNotebookById,
  getNotebookStats,
  updateNotebook,
} from "./notebook.service.js";

import {
  getNotebookForDeletion,
} from "./notebook.service.js";

import {
  deleteNotebookVectors,
} from "../../indexing/index.js";

import {
  deleteStoredFiles,
} from "../../storage/deleteStoredFiles.js";

export async function createNotebookController(
  request,
  response
) {
  try {
    const { title, description } = request.body;

    if (
      typeof title !== "string" ||
      !title.trim()
    ) {
      return response.status(400).json({
        success: false,
        message: "Notebook title is required",
      });
    }

    const notebook = await createNotebook({
      title: title.trim(),

      description:
        typeof description === "string"
          ? description.trim()
          : undefined,
    });

    return response.status(201).json({
      success: true,
      data: notebook,
    });
  } catch (error) {
    console.error(
      "Create notebook failed:",
      error
    );

    return response.status(500).json({
      success: false,
      message: "Unable to create notebook",
    });
  }
}

export async function getAllNotebooksController(
  request,
  response
) {
  try {
    const notebooks =
      await getAllNotebooks();

    return response.status(200).json({
      success: true,
      data: notebooks,
    });
  } catch (error) {
    console.error(
      "Get notebooks failed:",
      error
    );

    return response.status(500).json({
      success: false,
      message: "Unable to fetch notebooks",
    });
  }
}

export async function getNotebookByIdController(
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

    return response.status(200).json({
      success: true,
      data: notebook,
    });
  } catch (error) {
    console.error(
      "Get notebook failed:",
      error
    );

    return response.status(500).json({
      success: false,
      message: "Unable to fetch notebook",
    });
  }
}

export async function updateNotebookController(
  request,
  response
) {
  try {
    const { notebookId } = request.params;
    const { title, description } = request.body;

    if (
      title === undefined &&
      description === undefined
    ) {
      return response.status(400).json({
        success: false,
        message:
          "Provide title or description to update",
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
          "Notebook title cannot be empty",
      });
    }

    const existingNotebook =
      await getNotebookById(notebookId);

    if (!existingNotebook) {
      return response.status(404).json({
        success: false,
        message: "Notebook not found",
      });
    }

    const notebook =
      await updateNotebook(notebookId, {
        title:
          typeof title === "string"
            ? title.trim()
            : undefined,

        description:
          typeof description === "string"
            ? description.trim()
            : description,
      });

    return response.status(200).json({
      success: true,
      data: notebook,
    });
  } catch (error) {
    console.error(
      "Update notebook failed:",
      error
    );

    return response.status(500).json({
      success: false,
      message: "Unable to update notebook",
    });
  }
}

export async function deleteNotebookController(
  request,
  response
) {
  try {
    const notebookId =
      request.params.notebookId ??
      request.params.id;

    const notebook =
      await getNotebookForDeletion(
        notebookId
      );

    if (!notebook) {
      return response.status(404).json({
        success: false,
        message: "Notebook not found",
      });
    }

    // Qdrant ke saare notebook vectors delete
    await deleteNotebookVectors(
      notebookId
    );

    // Notebook ki uploaded files ke paths
    const storagePaths =
      notebook.sources
        .map((source) => source.storagePath)
        .filter(Boolean);

    // Local files delete
    await deleteStoredFiles(
      storagePaths
    );

    // Database notebook delete
    // Cascade se sources, conversations,
    // aur messages bhi delete ho jayenge.
    await deleteNotebook(
      notebookId
    );

    return response.status(200).json({
      success: true,
      message:
        "Notebook and related data deleted successfully",
      data: {
        deletedNotebookId: notebookId,
        deletedSourcesCount:
          notebook.sources.length,
        deletedFilesCount:
          storagePaths.length,
      },
    });
  } catch (error) {
    console.error(
      "Delete notebook failed:",
      error
    );

    return response.status(500).json({
      success: false,
      message:
        "Unable to completely delete notebook",
      error: error.message,
    });
  }
}

export async function getNotebookStatsController(
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

    const stats =
      await getNotebookStats(notebookId);

    return response.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error(
      "Get notebook stats failed:",
      error
    );

    return response.status(500).json({
      success: false,
      message:
        "Unable to fetch notebook stats",
    });
  }
}
