import type { KnowledgeRepository } from "./knowledge-repository.js";
import { KnowledgeLearningService } from "./knowledge-learning.service.js";
import { RelationshipExtractor } from "./relationship-extractor.js";
import { RelationshipLearner } from "./relationship-learner.js";
import type {
  KnowledgeSeedData,
  KnowledgeSeedReport,
  UnknownKnowledgeEntry
} from "./types.js";
import { vocabularyIndex, normalizePhrase, type VocabularyIndex } from "../sentence-learning/category-matcher.js";
import { enumeratePatterns, getPatternCap, RuleLearner } from "../sentence-learning/rule-learner.js";
import type { RuleStore } from "../sentence-learning/rule-store.js";
import { analyzeInput } from "../sentence-learning/tokenizer.js";

export class KnowledgeSeeder {
  private readonly relationshipLearner: RelationshipLearner;
  private readonly knowledgeLearning: KnowledgeLearningService;

  constructor(
    private readonly ruleStore: RuleStore,
    private readonly repository: KnowledgeRepository,
    private readonly vocabulary: VocabularyIndex = vocabularyIndex,
    private readonly cap: number = getPatternCap()
  ) {
    this.relationshipLearner = new RelationshipLearner(
      this.repository,
      this.vocabulary
    );
    this.knowledgeLearning = new KnowledgeLearningService(
      new RuleLearner(this.ruleStore, this.vocabulary, this.cap),
      new RelationshipExtractor(),
      this.repository,
      this.vocabulary,
      this.cap
    );
  }

  async seed(data: KnowledgeSeedData): Promise<KnowledgeSeedReport> {
    const existingRules = await this.ruleStore.getRules();
    const existingExamples = new Set(
      existingRules.flatMap((rule) => rule.examples)
    );
    const distinctPatterns = new Set<string>();
    const unknownTokens = new Set<string>();
    const unknown: UnknownKnowledgeEntry[] = [];
    const errors: string[] = [];
    let relationshipsAdded = 0;
    let relationshipsUpdated = 0;
    let relationshipsSkipped = 0;
    let rulesAdded = 0;
    let rulesReused = 0;
    let sentencesLearned = 0;
    let sentencesSkipped = 0;

    for (const group of data.directRelationships) {
      const result = await this.relationshipLearner.teach({
        word: group.word,
        category: group.category,
        related: group.related,
        observationId:
          group.observationId ??
          `seed:direct:${normalizePhrase(group.word)}:${group.category}`
      });

      relationshipsAdded += result.added.length;
      relationshipsUpdated += result.updated.length;
      relationshipsSkipped += result.skipped.length;
      unknown.push(...result.unknown);
    }

    for (const sentence of data.sentences) {
      const parsed = analyzeInput(sentence, this.vocabulary);
      const { patterns } = enumeratePatterns(parsed.parts, this.cap);

      for (const pattern of patterns) {
        distinctPatterns.add(JSON.stringify(pattern));
      }

      if (parsed.unknownTokens.length > 0) {
        for (const token of parsed.unknownTokens) {
          unknownTokens.add(token);
          unknown.push({
            word: token,
            role: "focus",
            reason: `Unknown token in seed sentence "${sentence}".`
          });
        }
        sentencesSkipped += 1;
        continue;
      }

      const observationId = `seed:sentence:${normalizePhrase(sentence)}`;

      if (existingExamples.has(sentence)) {
        const result = await this.knowledgeLearning.extractOnly(sentence, {
          observationId
        });

        if (result.relationshipError) {
          errors.push(result.relationshipError);
        }

        relationshipsAdded += result.relationshipsLearned.filter(
          (relationship) => relationship.action === "added"
        ).length;
        relationshipsUpdated += result.relationshipsLearned.filter(
          (relationship) => relationship.action === "updated"
        ).length;
        relationshipsSkipped += result.relationshipsSkipped.length;
        sentencesSkipped += 1;
        continue;
      }

      const result = await this.knowledgeLearning.learn(sentence, {
        observationId
      });

      existingExamples.add(sentence);
      rulesAdded += result.learned.length;
      rulesReused += result.existingRuleIds.length;
      relationshipsAdded += result.relationshipsLearned.filter(
        (relationship) => relationship.action === "added"
      ).length;
      relationshipsUpdated += result.relationshipsLearned.filter(
        (relationship) => relationship.action === "updated"
      ).length;
      relationshipsSkipped += result.relationshipsSkipped.length;
      sentencesLearned += 1;

      for (const token of result.unknownTokens) {
        unknownTokens.add(token);
      }

      if (result.relationshipError) {
        errors.push(result.relationshipError);
      }
    }

    const totalRules = (await this.ruleStore.getRules()).length;

    return {
      sentencesProcessed: data.sentences.length,
      sentencesLearned,
      sentencesSkipped,
      rulesAdded,
      rulesReused,
      distinctPatternsFromSeed: distinctPatterns.size,
      totalRules,
      relationshipsAdded,
      relationshipsUpdated,
      relationshipsSkipped,
      unknown,
      unknownTokens: [...unknownTokens],
      errors
    };
  }
}
