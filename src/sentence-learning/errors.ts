export type LearningErrorCode =
  | "RULE_NOT_FOUND"
  | "NO_RULES"
  | "EMPTY_CATEGORY"
  | "WORD_NOT_IN_CATEGORY"
  | "WORDS_LENGTH_MISMATCH"
  | "INVALID_WORDS"
  | "INVALID_SEED";

export class LearningError extends Error {
  constructor(
    message: string,
    readonly code: LearningErrorCode,
    readonly statusCode = 400
  ) {
    super(message);
    this.name = "LearningError";
  }
}
