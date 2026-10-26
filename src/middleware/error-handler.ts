import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";

interface HttpError extends Error {
  status?: number;
  statusCode?: number;
  type?: string;
}

function isHttpError(error: unknown): error is HttpError {
  return error instanceof Error;
}

export const notFoundHandler: RequestHandler = (request, response) => {
  response.status(404).json({
    error: {
      message: `Route ${request.method} ${request.originalUrl} was not found`,
      requestId: response.locals.requestId
    }
  });
};

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  _request,
  response,
  next
) => {
  if (response.headersSent) {
    next(error);
    return;
  }

  if (error instanceof ZodError) {
    response.status(400).json({
      error: {
        message: "Request validation failed",
        details: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message
        })),
        requestId: response.locals.requestId
      }
    });
    return;
  }

  const httpError = isHttpError(error) ? error : undefined;
  const statusCode = httpError?.statusCode ?? httpError?.status ?? 500;
  const message =
    statusCode >= 500 || !httpError
      ? "Internal server error"
      : httpError.message;

  if (statusCode >= 500) {
    console.error(error);
  }

  response.status(statusCode).json({
    error: {
      message,
      requestId: response.locals.requestId
    }
  });
};
