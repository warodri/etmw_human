import { tokenize } from "../services/tokenizer.service.js";
import type { TokenAnalysis, ParsedSentence } from "./types.js";
import type { VocabularyIndex } from "./category-matcher.js";

function trimLeadingWhitespace(value: string): string {
  return value.replace(/^\s+/, "");
}

function trimTrailingWhitespace(value: string): string {
  return value.replace(/\s+$/, "");
}

export function analyzeInput(
  input: string,
  index: VocabularyIndex
): ParsedSentence {
  const tokens = tokenize(input);
  const parts: TokenAnalysis[] = [];
  let cursor = 0;

  while (cursor < tokens.length) {
    const token = tokens[cursor]!;

    if (token.isPunctuation) {
      cursor += 1;
      continue;
    }

    const match = index.matchAt(tokens, cursor);

    if (match) {
      const last = tokens[cursor + match.tokenCount - 1]!;

      parts.push({
        text: input.slice(token.start, last.end),
        possibleCategories: [...match.categories],
        start: token.start,
        end: last.end
      });

      cursor += match.tokenCount;
      continue;
    }

    parts.push({
      text: token.text,
      possibleCategories: [],
      start: token.start,
      end: token.end
    });

    cursor += 1;
  }

  const unknownTokens = Array.from(
    new Set(
      parts
        .filter((part) => part.possibleCategories.length === 0)
        .map((part) => part.text)
    )
  );

  if (parts.length === 0) {
    return {
      parts,
      separators: [input.trim()],
      unknownTokens
    };
  }

  const separators: string[] = [
    trimLeadingWhitespace(input.slice(0, parts[0]!.start))
  ];

  for (let index = 1; index < parts.length; index += 1) {
    separators.push(
      input.slice(parts[index - 1]!.end, parts[index]!.start)
    );
  }

  separators.push(
    trimTrailingWhitespace(input.slice(parts[parts.length - 1]!.end))
  );

  return {
    parts,
    separators,
    unknownTokens
  };
}
