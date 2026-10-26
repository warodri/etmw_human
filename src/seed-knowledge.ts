import "dotenv/config";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defaultRuleStore } from "./sentence-learning/rule-store.js";
import { vocabularyIndex } from "./sentence-learning/category-matcher.js";
import { createKnowledgeRepository } from "./word-knowledge/knowledge-repository.factory.js";
import { KnowledgeSeeder } from "./word-knowledge/knowledge-seeder.js";
import type { KnowledgeSeedData } from "./word-knowledge/types.js";

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(moduleDirectory, "..");
const seedPath = path.join(
  projectRoot,
  "src",
  "data",
  "knowledge-seed.json"
);
const data = JSON.parse(
  await readFile(seedPath, "utf8")
) as KnowledgeSeedData;
const repository = createKnowledgeRepository();
const seeder = new KnowledgeSeeder(
  defaultRuleStore,
  repository,
  vocabularyIndex
);
const report = await seeder.seed(data);

console.log("Knowledge seed complete");
console.log(`Sentences processed: ${report.sentencesProcessed}`);
console.log(`  learned now: ${report.sentencesLearned}`);
console.log(`  already present or skipped: ${report.sentencesSkipped}`);
console.log(`Rules added: ${report.rulesAdded}`);
console.log(`Rule patterns reused: ${report.rulesReused}`);
console.log(`Distinct patterns observed in seed: ${report.distinctPatternsFromSeed}`);
console.log(`Total learned rules now: ${report.totalRules}`);
console.log(`Relationships added: ${report.relationshipsAdded}`);
console.log(`Relationships updated: ${report.relationshipsUpdated}`);
console.log(`Relationships skipped: ${report.relationshipsSkipped}`);
console.log(`Unknown words: ${report.unknownTokens.length}`);
console.log(`Unknown entries: ${report.unknown.length}`);
console.log(`Errors: ${report.errors.length}`);

for (const unknown of report.unknown) {
  console.log(
    `UNKNOWN [${unknown.role}] ${unknown.word} (${unknown.category ?? "no category"}): ${unknown.reason}`
  );
}

for (const error of report.errors) {
  console.log(`ERROR: ${error}`);
}

if (report.errors.length > 0 || report.unknown.length > 0) {
  process.exitCode = 1;
}
