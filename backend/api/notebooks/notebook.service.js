import { prisma } from "../../db/index.js";

/**
 * Flow:
 * Notebook data
 * → Prisma
 * → PostgreSQL
 */
export async function createNotebook({
  title,
  description,
}) {
  return prisma.notebook.create({
    data: {
      title,
      description: description || null,
    },
  });
}

export async function getAllNotebooks() {
  return prisma.notebook.findMany({
    orderBy: {
      createdAt: "desc",
    },

    include: {
      _count: {
        select: {
          sources: true,
          conversations: true,
        },
      },
    },
  });
}

export async function getNotebookById(notebookId) {
  return prisma.notebook.findUnique({
    where: {
      id: notebookId,
    },

    include: {
      sources: {
        orderBy: {
          createdAt: "desc",
        },
      },

      conversations: {
        orderBy: {
          createdAt: "desc",
        },

        include: {
          _count: {
            select: {
              messages: true,
            },
          },
        },
      },
    },
  });
}

export async function updateNotebook(
  notebookId,
  {
    title,
    description,
  }
) {
  return prisma.notebook.update({
    where: {
      id: notebookId,
    },

    data: {
      ...(title !== undefined && {
        title,
      }),

      ...(description !== undefined && {
        description: description || null,
      }),
    },
  });
}

export async function deleteNotebook(notebookId) {
  return prisma.notebook.delete({
    where: {
      id: notebookId,
    },
  });
}



export async function getNotebookForDeletion(
  notebookId
) {
  return prisma.notebook.findUnique({
    where: {
      id: notebookId,
    },

    include: {
      sources: {
        select: {
          id: true,
          title: true,
          storagePath: true,
        },
      },
    },
  });
}

export async function getNotebookStats(
  notebookId
) {
  const [
    sourcesByStatus,
    sourceTypes,
    conversations,
    messages,
  ] = await Promise.all([
    prisma.source.groupBy({
      by: ["status"],
      where: {
        notebookId,
      },
      _count: {
        _all: true,
      },
    }),
    prisma.source.groupBy({
      by: ["type"],
      where: {
        notebookId,
      },
      _count: {
        _all: true,
      },
    }),
    prisma.conversation.count({
      where: {
        notebookId,
      },
    }),
    prisma.message.count({
      where: {
        conversation: {
          notebookId,
        },
      },
    }),
  ]);

  const sourceCounts = {
    total: 0,
    pending: 0,
    processing: 0,
    ready: 0,
    failed: 0,
  };

  for (const item of sourcesByStatus) {
    const count = item._count._all;
    sourceCounts.total += count;
    sourceCounts[
      item.status.toLowerCase()
    ] = count;
  }

  return {
    notebookId,
    sources: sourceCounts,
    conversations,
    messages,
    sourceTypes: Object.fromEntries(
      sourceTypes.map((item) => [
        item.type,
        item._count._all,
      ])
    ),
  };
}
