import { normalizeText } from "../utils/normalize.js";

export interface RawToken {
  text: string;
  normalized: string;
  lower: string;
  start: number;
  end: number;
  isPunctuation: boolean;
}

const tokenPattern =
  /[\p{L}\p{M}]+(?:['\u2019-][\p{L}\p{M}]+)*|\d+(?:[.,]\d+)*|[^\s\p{L}\p{M}\p{N}]/gu;

export function tokenize(input: string): RawToken[] {
  const tokens: RawToken[] = [];

  for (const match of input.matchAll(tokenPattern)) {
    const text = match[0];
    const start = match.index ?? 0;
    const normalized = normalizeText(text);

    tokens.push({
      text,
      normalized,
      lower: normalized.toLowerCase(),
      start,
      end: start + text.length,
      isPunctuation: !/[\p{L}\p{M}\p{N}]/u.test(normalized)
    });
  }

  return tokens;
}
