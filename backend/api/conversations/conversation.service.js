import { prisma } from "../../db/index.js";

export async function createConversation({
  notebookId,
  title,
}) {
  return prisma.conversation.create({
    data: {
      notebookId,
      title: title || "New conversation",
    },
  });
}

export async function getConversationsByNotebookId(
  notebookId
) {
  const conversations =
    await prisma.conversation.findMany({
    where: {
      notebookId,
    },

    orderBy: {
      updatedAt: "desc",
    },

    include: {
      _count: {
        select: {
          messages: true,
        },
      },
      messages: {
        orderBy: {
          createdAt: "desc",
        },
        take: 1,
        select: {
          id: true,
          role: true,
          content: true,
          createdAt: true,
        },
      },
    },
  });

  return conversations.map(
    ({ messages, _count, ...conversation }) => ({
      ...conversation,
      messageCount: _count.messages,
      lastMessagePreview:
        messages[0] === undefined
          ? null
          : {
              id: messages[0].id,
              role: messages[0].role,
              content:
                messages[0].content.length > 160
                  ? `${messages[0].content.slice(0, 157)}...`
                  : messages[0].content,
              createdAt:
                messages[0].createdAt,
            },
    })
  );
}

export async function getConversationById(
  conversationId
) {
  return prisma.conversation.findUnique({
    where: {
      id: conversationId,
    },

    include: {
      notebook: {
        select: {
          id: true,
          title: true,
        },
      },
      _count: {
        select: {
          messages: true,
        },
      },
    },
  });
}

export async function updateConversation(
  conversationId,
  {
    title,
  }
) {
  return prisma.conversation.update({
    where: {
      id: conversationId,
    },

    data: {
      ...(title !== undefined && {
        title,
      }),
    },
  });
}

export async function deleteConversation(
  conversationId
) {
  return prisma.conversation.delete({
    where: {
      id: conversationId,
    },
  });
}

export async function updateConversationTitle({
  conversationId,
  title,
}) {
  if (!conversationId) {
    throw new Error(
      "conversationId is required"
    );
  }

  if (
    typeof title !== "string" ||
    !title.trim()
  ) {
    throw new Error(
      "Conversation title is required"
    );
  }

  return prisma.conversation.update({
    where: {
      id: conversationId,
    },

    data: {
      title: title.trim(),
    },
  });
}
