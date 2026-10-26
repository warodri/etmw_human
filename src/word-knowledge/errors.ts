export type KnowledgeErrorCode =
  | "INVALID_KNOWLEDGE_INPUT"
  | "KNOWLEDGE_STORAGE_ERROR";

export class KnowledgeError extends Error {
  constructor(
    message: string,
    readonly code: KnowledgeErrorCode,
    readonly statusCode = 400
  ) {
    super(message);
    this.name = "KnowledgeError";
  }
}
