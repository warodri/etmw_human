import { env } from "../config/env.js";
import { InMemoryLexiconRepository } from "./in-memory-lexicon.repository.js";
import type { LexiconRepository } from "./lexicon.repository.js";

export function createLexiconRepository(): LexiconRepository {
  switch (env.lexiconDriver) {
    case "memory":
      return new InMemoryLexiconRepository();
  }
}
