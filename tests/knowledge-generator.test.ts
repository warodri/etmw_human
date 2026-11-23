import { describe, expect, it } from "vitest";
import { normalizePhrase, vocabularyIndex } from "../src/sentence-learning/category-matcher.js";
import { SentenceGenerator } from "../src/sentence-learning/sentence-generator.js";
import type { LearnedRule } from "../src/sentence-learning/types.js";
import { KnowledgeGenerator } from "../src/word-knowledge/knowledge-generator.js";
import type { KnowledgeRepository } from "../src/word-knowledge/knowledge-repository.js";
import type {
  RelatedWord,
  RepositoryUpsertSummary,
  WordKnowledge
} from "../src/word-knowledge/types.js";

class FakeKnowledgeRepository implements KnowledgeRepository {
  constructor(private readonly entries: WordKnowledge[]) {}

  async getByWord(word: string): Promise<WordKnowledge[]> {
    const normalized = normalizePhrase(word);
    return structuredClone(
      this.entries.filter(
        (entry) => normalizePhrase(entry.word) === normalized
      )
    );
  }

  async getByWordAndCategory(
    word: string,
    category: WordKnowledge["category"]
  ): Promise<WordKnowledge | undefined> {
    const normalized = normalizePhrase(word);
    const entry = this.entries.find(
      (candidate) =>
        normalizePhrase(candidate.word) === normalized &&
        candidate.category === category
    );
    return entry ? structuredClone(entry) : undefined;
  }

  async upsertRelationships(): Promise<RepositoryUpsertSummary> {
    return { added: [], updated: [], skipped: [] };
  }

  async list(): Promise<WordKnowledge[]> {
    return structuredClone(this.entries);
  }

  async clear(): Promise<void> {
    this.entries.splice(0, this.entries.length);
  }
}

function related(
  word: string,
  category: RelatedWord["category"]
): RelatedWord {
  return {
    word,
    category,
    occurrences: 1,
    sources: ["sentence"],
    examples: []
  };
}

const skyKnowledge: WordKnowledge[] = [
  {
    word: "sky",
    category: "nouns",
    related: [related("blue", "adjectives"), related("beautiful", "adjectives")]
  }
];

const dogKnowledge: WordKnowledge[] = [
  {
    word: "dog",
    category: "nouns",
    related: [
      related("animal", "nouns"),
      related("dangerous", "adjectives"),
      related("beautiful", "adjectives")
    ]
  }
];

const hotelWithSystem: WordKnowledge[] = [
  {
    word: "hotel",
    category: "nouns",
    related: [
      related("big", "adjectives"),
      related("building", "nouns"),
      related("building", "system")
    ]
  },
  {
    word: "building",
    category: "nouns",
    related: [related("beautiful", "adjectives")]
  }
];

const hotelWithName: WordKnowledge[] = [
  {
    word: "hotel",
    category: "nouns",
    related: [related("woman", "name")]
  }
];

const hiltonNameOnly: WordKnowledge[] = [
  {
    word: "hilton",
    category: "name",
    related: [related("paris", "name")]
  }
];

const adjectiveRule: LearnedRule = {
  id: "rule_sky",
  pattern: ["articles", "nouns", "auxiliaryVerbs", "adjectives"],
  examples: ["The sky is blue."],
  count: 1,
  separators: ["", " ", " ", "."]
};

const nounRule: LearnedRule = {
  id: "rule_animal",
  pattern: ["articles", "nouns", "auxiliaryVerbs", "articles", "nouns"],
  examples: ["The dog is an animal."],
  count: 1,
  separators: ["", " ", " ", " ", "."]
};

function makeGenerator(
  entries: WordKnowledge[],
  rules: LearnedRule[] = [adjectiveRule, nounRule]
): KnowledgeGenerator {
  return new KnowledgeGenerator(
    new FakeKnowledgeRepository(entries),
    async () => rules,
    new SentenceGenerator(vocabularyIndex)
  );
}

describe("knowledge-guided generation", () => {
  it("uses the requested focus word and a stored related word", async () => {
    const result = await makeGenerator(skyKnowledge).generate("sky", {
      seed: 42
    });

    expect(result.focusWord).toBe("sky");
    expect(result.sentences.length).toBeGreaterThan(0);

    for (const sentence of result.sentences) {
      expect(sentence.sentence.toLowerCase()).toContain("sky");
      expect(["blue", "beautiful"]).toContain(sentence.relatedWord);
      expect(sentence.source).toBe("learned-relationship");
      expect(sentence.ruleId).toBe("rule_sky");
      expect(sentence.words).toContain("sky");
      expect(sentence.words).toContain(sentence.relatedWord);
    }
  });

  it("is deterministic with a seed", async () => {
    const first = await makeGenerator(skyKnowledge).generate("sky", {
      seed: 7
    });
    const second = await makeGenerator(skyKnowledge).generate("sky", {
      seed: 7
    });

    expect(first).toEqual(second);
  });

  it("respects maxSentences", async () => {
    const result = await makeGenerator(skyKnowledge).generate("sky", {
      seed: 1,
      maxSentences: 1
    });

    expect(result.sentences).toHaveLength(1);
  });

  it("generates from noun-to-noun knowledge", async () => {
    const result = await makeGenerator(dogKnowledge).generate("dog", {
      seed: 3
    });
    const animalSentence = result.sentences.find(
      (sentence) => sentence.relatedWord === "animal"
    );

    expect(animalSentence?.ruleId).toBe("rule_animal");
    expect(animalSentence?.sentence.toLowerCase()).toContain("dog");
    expect(animalSentence?.sentence.toLowerCase()).toContain("animal");
  });

  it("preserves the requested display text for the focus word", async () => {
    const result = await makeGenerator(skyKnowledge).generate("Sky", {
      seed: 42,
      maxSentences: 1
    });

    expect(result.sentences[0]?.sentence).toContain("Sky");
  });

  it("returns an informative empty result for unknown knowledge", async () => {
    const result = await makeGenerator([]).generate("table");

    expect(result.sentences).toEqual([]);
    expect(result.reason).toContain("No stored relationships");
  });

  it("returns an empty result when no learned rule fits", async () => {
    const result = await makeGenerator(skyKnowledge, [
      {
        id: "rule_none",
        pattern: ["personalPronouns", "mainVerbs"],
        examples: ["I run."],
        count: 1
      }
    ]).generate("sky", { seed: 1 });

    expect(result.sentences).toEqual([]);
    expect(result.reason).toContain("No learned rule can host");
  });

  it("returns an empty result for an unknown rule id", async () => {
    const result = await makeGenerator(skyKnowledge).generate("sky", {
      ruleId: "missing_rule"
    });

    expect(result.sentences).toEqual([]);
    expect(result.reason).toContain("was not found");
  });

  it("does not return duplicate sentence strings", async () => {
    const result = await makeGenerator(skyKnowledge).generate("sky", {
      seed: 2,
      maxSentences: 20
    });
    const strings = result.sentences.map((sentence) => sentence.sentence);

    expect(new Set(strings).size).toBe(strings.length);
  });

  it("uses inherited ordinary relationships", async () => {
    const result = await makeGenerator(hotelWithSystem).generate("hotel", {
      seed: 1,
      maxSentences: 20
    });
    const beautiful = result.sentences.find(
      (sentence) => sentence.relatedWord === "beautiful"
    );

    expect(beautiful).toMatchObject({
      relatedCategory: "adjectives",
      relatedSlotCategory: "adjectives",
      relatedOrigin: "inherited",
      inheritedFrom: "building",
      path: ["hotel", "building"]
    });
    expect(beautiful?.sentence.toLowerCase()).toContain("hotel");
    expect(beautiful?.sentence.toLowerCase()).toContain("beautiful");
    expect(
      result.sentences.some((sentence) => sentence.relatedCategory === "system")
    ).toBe(false);
  });

  it("uses a name association when a compatible catalogue slot exists", async () => {
    const result = await makeGenerator(hotelWithName).generate("hotel", {
      seed: 1,
      maxSentences: 10
    });
    const woman = result.sentences.find(
      (sentence) => sentence.relatedWord === "woman"
    );

    expect(woman).toMatchObject({
      relatedCategory: "name",
      relatedSlotCategory: "nouns",
      relatedOrigin: "direct"
    });
    expect(woman?.sentence.toLowerCase()).toContain("woman");
  });

  it("returns no fabricated sentence for a name-only focus word", async () => {
    const result = await makeGenerator(hiltonNameOnly).generate("hilton", {
      seed: 1
    });

    expect(result.sentences).toEqual([]);
    expect(result.reason).toContain("no compatible catalogue category");
  });
});
