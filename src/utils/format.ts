import type { TaggingResult } from "../types/tagging.js";

export function formatTagging(result: TaggingResult): string {
  return result.tokens
    .filter((token) => token.category !== "punctuation")
    .map((token) => `${token.word} = ${token.category}`)
    .join("\n");
}
