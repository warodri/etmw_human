import path from "node:path";
import { env } from "../config/env.js";
import { JsonKnowledgeRepository } from "./json-knowledge.repository.js";
import type { KnowledgeRepository } from "./knowledge-repository.js";

export function createKnowledgeRepository(): KnowledgeRepository {
  switch (env.knowledgeDriver) {
    case "json":
      return new JsonKnowledgeRepository(
        env.wordKnowledgeFile
          ? path.resolve(env.wordKnowledgeFile)
          : undefined,
        env.knowledgeExampleLimit
      );
  }
}
