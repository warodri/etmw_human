import { getRules, learnSentences } from "./sentence-learning/index.js";

const demoExamples = [
  "The dog can run quickly.",
  "She will visit us tomorrow.",
  "They are in the garden.",
  "He is very happy.",
  "This is my book.",
  "I do not drink coffee.",
  "You should study your lesson.",
  "I always drink tea.",
  "The cat is under the table.",
  "I want to read a book.",
  "We should help each other.",
  "Don't go there."
];

const existingRules = await getRules();
const learnedExamples = new Set(
  existingRules.flatMap((rule) => rule.examples)
);
const freshExamples = demoExamples.filter(
  (sentence) => !learnedExamples.has(sentence)
);

if (freshExamples.length === 0) {
  console.log("All demonstration sentences are already present.");
} else {
  const results = await learnSentences(freshExamples);

  for (const result of results) {
    console.log(`\nLEARNED: ${result.input}`);
    console.log(
      result.tokens
        .map(
          (token) =>
            `${token.text} → ${
              token.possibleCategories.join(" | ") || "unknown"
            }`
        )
        .join("\n")
    );

    if (result.learned.length > 0) {
      for (const rule of result.learned) {
        console.log(
          `${rule.id}  ${rule.pattern.join(" → ")}  examples=${JSON.stringify(rule.examples)}`
        );
      }
    }

    if (result.existingRuleIds.length > 0) {
      console.log(`Updated existing: ${result.existingRuleIds.join(", ")}`);
    }

    if (result.unknownTokens.length > 0) {
      console.log(`Unknown: ${result.unknownTokens.join(", ")}`);
    }
  }
}

const rules = await getRules();
console.log(`\nTOTAL RULES: ${rules.length}`);
