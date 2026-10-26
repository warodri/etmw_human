import {
  generateFromRule,
  getRules,
  learnSentence,
  matchSentence
} from "./sentence-learning/index.js";

const examples = [
  "I'm a dog.",
  "I am a dog.",
  "She is happy.",
  "The big dog is happy.",
  "I am in front of the house.",
  "It’s a dog."
];

for (const sentence of examples) {
  const result = await learnSentence(sentence);

  console.log(`\nINPUT: ${result.input}`);
  console.log(
    result.tokens
      .map(
        (token) =>
          `${token.text} → ${
            token.possibleCategories.length > 0
              ? token.possibleCategories.join(" | ")
              : "unknown"
          }`
      )
      .join("\n")
  );

  const newIds = result.learned.map((rule) => rule.id);
  console.log(`NEW RULES: ${newIds.length > 0 ? newIds.join(", ") : "none"}`);
  console.log(
    `EXISTING RULES: ${
      result.existingRuleIds.length > 0
        ? result.existingRuleIds.join(", ")
        : "none"
    }`
  );
  console.log(`TRUNCATED: ${result.truncated ? "yes" : "no"}`);

  if (result.unknownTokens.length > 0) {
    console.log(`UNKNOWN: ${result.unknownTokens.join(", ")}`);
  }
}

const unknownResult = await learnSentence("I florp a dog.");
console.log("\nUNKNOWN EXAMPLE: I florp a dog.");
console.log(`UNKNOWN TOKENS: ${unknownResult.unknownTokens.join(", ")}`);
console.log(`NEW RULES: ${unknownResult.learned.length}`);

const rules = await getRules();
console.log(`\nRULES STORED: ${rules.length}`);

for (const rule of rules) {
  console.log(
    `${rule.id}  count=${rule.count}  ${rule.pattern.join(" → ")}  examples=${JSON.stringify(rule.examples)}`
  );
}

const match = await matchSentence("I'm a cat.");
console.log(`\nMATCH "I'm a cat.": ${match.ruleIds.join(", ") || "none"}`);

const dogRule = rules.find(
  (rule) =>
    JSON.stringify(rule.pattern) ===
    JSON.stringify(["contractions", "articles", "nouns"])
);

if (dogRule) {
  const explicit = await generateFromRule(dogRule.id, {
    words: ["It's", "a", "dog"]
  });
  console.log(`\nEXPLICIT GENERATION (${dogRule.id}): ${explicit.sentence}`);

  const first = await generateFromRule(dogRule.id, { seed: 7 });
  const second = await generateFromRule(dogRule.id, { seed: 7 });
  console.log(`SEEDED GENERATION: ${first.sentence}`);
  console.log(`SEEDED GENERATION REPEATED: ${second.sentence}`);
  console.log(`SAME RESULT: ${first.sentence === second.sentence ? "yes" : "no"}`);
}
