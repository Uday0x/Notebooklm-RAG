import { Prisma } from "@prisma/client";

export class AppError extends Error {
  constructor(
    message,
    {
      statusCode = 500,
      code = "INTERNAL_ERROR",
      details = null,
      isOperational = true,
    } = {}
  ) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = isOperational;
  }
}

export function asyncHandler(handler) {
  return (request, response, next) => {
    Promise.resolve(handler(request, response, next)).catch(next);
  };
}

export function notFoundHandler(request, response) {
  response.status(404).json({
    success: false,
    error: {
      code: "ROUTE_NOT_FOUND",
      message: "Route not found",
      details: {
        method: request.method,
        path: request.originalUrl,
      },
    },
  });
}

export function errorHandler(error, request, response, next) {
  if (response.headersSent) {
    return next(error);
  }

  const normalized = normalizeError(error);

  if (normalized.statusCode >= 500) {
    console.error("Unexpected request error:", error);
  }

  response.status(normalized.statusCode).json({
    success: false,
    error: {
      code: normalized.code,
      message: normalized.message,
      details: normalized.details,
    },
  });
}

function normalizeError(error) {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2025") {
      return new AppError("Record not found", {
        statusCode: 404,
        code: "RECORD_NOT_FOUND",
      });
    }

    if (error.code === "P2002") {
      return new AppError("Unique constraint failed", {
        statusCode: 409,
        code: "UNIQUE_CONSTRAINT",
        details: error.meta ?? null,
      });
    }

    if (error.code === "P2003") {
      return new AppError("Invalid related resource", {
        statusCode: 409,
        code: "FOREIGN_KEY_CONSTRAINT",
        details: error.meta ?? null,
      });
    }
  }

  return new AppError("Internal server error", {
    statusCode: 500,
    code: "INTERNAL_ERROR",
    isOperational: false,
  });
}
