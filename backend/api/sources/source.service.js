import { prisma } from "../../db/index.js";

export async function createSource({
  notebookId,
  title,
  type,
  originalFileName,
  storagePath,
}) {
  return prisma.source.create({
    data: {
      notebookId,
      title,
      type,
      status: "PENDING",
      originalFileName: originalFileName || null,
      storagePath: storagePath || null,
    },
  });
}

export async function getSourcesByNotebookId(notebookId) {
  return prisma.source.findMany({
    where: {
      notebookId,
    },

    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function getSourceById(sourceId) {
  return prisma.source.findUnique({
    where: {
      id: sourceId,
    },

    include: {
      notebook: {
        select: {
          id: true,
          title: true,
        },
      },
    },
  });
}

export async function updateSource(
  sourceId,
  {
    title,
    status,
    originalFileName,
    storagePath,
  }
) {
  return prisma.source.update({
    where: {
      id: sourceId,
    },

    data: {
      ...(title !== undefined && {
        title,
      }),

      ...(status !== undefined && {
        status,
      }),

      ...(originalFileName !== undefined && {
        originalFileName:
          originalFileName || null,
      }),

      ...(storagePath !== undefined && {
        storagePath: storagePath || null,
      }),
    },
  });
}

export async function updateSourceStatus(
  sourceId,
  status,
  errorMessage = null
) {
  return prisma.source.update({
    where: {
      id: sourceId,
    },

    data: {
      status,
      errorMessage,
    },
  });
}

export async function deleteSource(sourceId) {
  return prisma.source.delete({
    where: {
      id: sourceId,
    },
  });
}