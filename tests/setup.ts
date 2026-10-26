import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const directory = mkdtempSync(path.join(tmpdir(), "etmw-human-tests-"));

process.env.LEARNED_RULES_FILE = path.join(directory, "learned-rules.json");
process.env.LEARNING_PATTERN_CAP = "100";
process.env.WORD_KNOWLEDGE_FILE = path.join(directory, "word-knowledge.json");
process.env.KNOWLEDGE_EXAMPLE_LIMIT = "3";
process.env.KNOWLEDGE_DRIVER = "json";

process.on("exit", () => {
  try {
    rmSync(directory, { recursive: true, force: true });
  } catch {
    return;
  }
});
