import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";

export const requestId: RequestHandler = (_request, response, next) => {
  const id = randomUUID();
  response.setHeader("x-request-id", id);
  response.locals.requestId = id;
  next();
};
