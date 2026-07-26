import { prisma } from "../../db/index.js";

export async function getConversationForChat(
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

          sources: {
            where: {
              status: "READY",
            },

            select: {
              id: true,
              title: true,
              type: true,
              status: true,
            },
          },
        },
      },
    },
  });
}

export async function createMessage({
  conversationId,
  role,
  content,
}) {
  return prisma.message.create({
    data: {
      conversationId,
      role,
      content,
    },
  });
}

export async function touchConversation(
  conversationId
) {
  return prisma.conversation.update({
    where: {
      id: conversationId,
    },

    data: {
      updatedAt: new Date(),
    },
  });
}



export async function getRecentMessages({
  conversationId,
  limit = 10,
}) {
  if (!conversationId) {
    throw new Error(
      "conversationId is required"
    );
  }

  const messages =
    await prisma.message.findMany({
      where: {
        conversationId,
      },

      orderBy: {
        createdAt: "desc",
      },

      take: limit,

      select: {
        id: true,
        role: true,
        content: true,
        createdAt: true,
      },
    });

  // Prisma latest message pehle deta hai.
  // LLM ko old → new order chahiye.
  return messages.reverse();
}

export async function getMessagesPage({
  conversationId,
  limit,
  cursor,
}) {
  const query = {
    where: {
      conversationId,
    },

    orderBy: [
      {
        createdAt: "asc",
      },
      {
        id: "asc",
      },
    ],

    take: limit + 1,

    select: {
      id: true,
      role: true,
      content: true,
      createdAt: true,
    },
  };

  if (cursor) {
    query.cursor = {
      id: cursor,
    };
    query.skip = 1;
  }

  const messages =
    await prisma.message.findMany(query);

  const hasMore =
    messages.length > limit;

  const pageMessages = hasMore
    ? messages.slice(0, limit)
    : messages;

  return {
    messages: pageMessages,
    nextCursor: hasMore
      ? pageMessages[pageMessages.length - 1]
          ?.id ?? null
      : null,
  };
}
