import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { VocabularyCategory } from "../data/vocabulary.js";
import { normalizePhrase } from "../sentence-learning/category-matcher.js";
import { KnowledgeError } from "./errors.js";
import type { KnowledgeRepository } from "./knowledge-repository.js";
import type {
  KnowledgeQueryOptions,
  KnowledgeRelationship,
  KnowledgeRelationshipInput,
  KnowledgeSource,
  RelatedWord,
  RepositoryUpsertSummary,
  WordKnowledge
} from "./types.js";

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(moduleDirectory, "../..");
const sourceOrder: KnowledgeSource[] = ["direct", "sentence"];

export function resolveKnowledgePath(): string {
  const configured = process.env.WORD_KNOWLEDGE_FILE;

  return configured
    ? path.resolve(configured)
    : path.join(projectRoot, "data", "word-knowledge.json");
}

export function resolveExampleLimit(): number {
  const configured = Number(process.env.KNOWLEDGE_EXAMPLE_LIMIT ?? 5);

  return Number.isInteger(configured) && configured > 0 ? configured : 5;
}

function cloneEntry(entry: WordKnowledge): WordKnowledge {
  return structuredClone(entry);
}

function isKnowledgeSource(value: unknown): value is KnowledgeSource {
  return value === "direct" || value === "sentence";
}

function parseStoredKnowledge(value: unknown): WordKnowledge[] {
  if (!Array.isArray(value)) {
    throw new Error("Word knowledge file must contain a JSON array.");
  }

  return value.map((entry, entryIndex) => {
    if (!entry || typeof entry !== "object") {
      throw new Error(`Invalid word knowledge entry at position ${entryIndex}.`);
    }

    const record = entry as Record<string, unknown>;
    const { word, category, related } = record;

    if (typeof word !== "string" || word.length === 0) {
      throw new Error(`Invalid focus word at position ${entryIndex}.`);
    }

    if (typeof category !== "string" || category.length === 0) {
      throw new Error(`Invalid focus category for "${word}".`);
    }

    if (!Array.isArray(related)) {
      throw new Error(`Invalid related list for "${word}".`);
    }

    const parsedRelated = related.map((relatedEntry, relatedIndex) => {
      if (!relatedEntry || typeof relatedEntry !== "object") {
        throw new Error(
          `Invalid related word for "${word}" at position ${relatedIndex}.`
        );
      }

      const relatedRecord = relatedEntry as Record<string, unknown>;
      const {
        word: relatedWord,
        category: relatedCategory,
        occurrences,
        sources,
        examples,
        observationIds
      } = relatedRecord;

      if (typeof relatedWord !== "string" || relatedWord.length === 0) {
        throw new Error(
          `Invalid related word text for "${word}" at position ${relatedIndex}.`
        );
      }

      if (typeof relatedCategory !== "string" || relatedCategory.length === 0) {
        throw new Error(
          `Invalid related category for "${word}" → "${relatedWord}".`
        );
      }

      if (
        typeof occurrences !== "number" ||
        !Number.isFinite(occurrences) ||
        occurrences < 0
      ) {
        throw new Error(
          `Invalid occurrences for "${word}" → "${relatedWord}".`
        );
      }

      if (
        !Array.isArray(sources) ||
        !sources.every(isKnowledgeSource)
      ) {
        throw new Error(`Invalid sources for "${word}" → "${relatedWord}".`);
      }

      if (
        !Array.isArray(examples) ||
        !examples.every((example) => typeof example === "string")
      ) {
        throw new Error(`Invalid examples for "${word}" → "${relatedWord}".`);
      }

      if (
        observationIds !== undefined &&
        (!Array.isArray(observationIds) ||
          !observationIds.every((id) => typeof id === "string"))
      ) {
        throw new Error(
          `Invalid observationIds for "${word}" → "${relatedWord}".`
        );
      }

      return {
        word: relatedWord,
        category: relatedCategory as VocabularyCategory,
        occurrences,
        sources: Array.from(new Set(sources)),
        examples: [...examples],
        ...(observationIds
          ? { observationIds: Array.from(new Set(observationIds)) }
          : {})
      } satisfies RelatedWord;
    });

    return {
      word,
      category: category as VocabularyCategory,
      related: parsedRelated
    } satisfies WordKnowledge;
  });
}

function mergeSource(
  sources: KnowledgeSource[],
  source: KnowledgeSource
): KnowledgeSource[] {
  return sourceOrder.filter(
    (candidate) => candidate === source || sources.includes(candidate)
  );
}

function addExample(
  examples: string[],
  example: string | undefined,
  limit: number
): string[] {
  if (!example) {
    return examples;
  }

  const next = examples.includes(example)
    ? examples
    : [...examples, example];

  return next.length > limit ? next.slice(-limit) : next;
}

function toRelationship(
  focusWord: string,
  focusCategory: VocabularyCategory,
  related: RelatedWord,
  action: KnowledgeRelationship["action"]
): KnowledgeRelationship {
  return {
    focusWord,
    focusCategory,
    relatedWord: related.word,
    relatedCategory: related.category,
    occurrences: related.occurrences,
    sources: [...related.sources],
    action
  };
}

export class JsonKnowledgeRepository implements KnowledgeRepository {
  private entries: WordKnowledge[] | null = null;
  private loading: Promise<WordKnowledge[]> | null = null;
  private queue: Promise<void> = Promise.resolve();

  constructor(
    private readonly filePath: string = resolveKnowledgePath(),
    private readonly exampleLimit: number = resolveExampleLimit()
  ) {}

  async getByWord(word: string): Promise<WordKnowledge[]> {
    const entries = await this.ensureLoaded();
    const normalized = normalizePhrase(word);

    return entries
      .filter((entry) => normalizePhrase(entry.word) === normalized)
      .map(cloneEntry);
  }

  async getByWordAndCategory(
    word: string,
    category: VocabularyCategory
  ): Promise<WordKnowledge | undefined> {
    const entries = await this.ensureLoaded();
    const normalized = normalizePhrase(word);
    const entry = entries.find(
      (candidate) =>
        normalizePhrase(candidate.word) === normalized &&
        candidate.category === category
    );

    return entry ? cloneEntry(entry) : undefined;
  }

  async list(options: KnowledgeQueryOptions = {}): Promise<WordKnowledge[]> {
    const entries = await this.ensureLoaded();
    const normalized = options.word ? normalizePhrase(options.word) : undefined;

    return entries
      .filter((entry) => {
        if (
          normalized &&
          normalizePhrase(entry.word) !== normalized
        ) {
          return false;
        }

        return !options.category || entry.category === options.category;
      })
      .map(cloneEntry);
  }

  async upsertRelationships(
    updates: KnowledgeRelationshipInput[]
  ): Promise<RepositoryUpsertSummary> {
    if (updates.length === 0) {
      return { added: [], updated: [], skipped: [] };
    }

    return this.enqueue(async () => {
      const current = await this.ensureLoaded();
      const entries = current.map(cloneEntry);
      const added: KnowledgeRelationship[] = [];
      const updated: KnowledgeRelationship[] = [];
      const skipped: KnowledgeRelationship[] = [];

      for (const update of updates) {
        const focusWord = update.focusWord.trim();
        const relatedWord = update.relatedWord.trim();

        if (focusWord.length === 0 || relatedWord.length === 0) {
          throw new KnowledgeError(
            "Focus and related words must not be empty.",
            "INVALID_KNOWLEDGE_INPUT",
            400
          );
        }

        const focusKey = normalizePhrase(focusWord);
        const relatedKey = normalizePhrase(relatedWord);
        let knowledge = entries.find(
          (entry) =>
            normalizePhrase(entry.word) === focusKey &&
            entry.category === update.focusCategory
        );

        if (!knowledge) {
          knowledge = {
            word: focusWord,
            category: update.focusCategory,
            related: []
          };
          entries.push(knowledge);
        }

        let related = knowledge.related.find(
          (candidate) =>
            normalizePhrase(candidate.word) === relatedKey &&
            candidate.category === update.relatedCategory
        );

        if (
          related &&
          update.observationId &&
          related.observationIds?.includes(update.observationId)
        ) {
          skipped.push(
            toRelationship(
              knowledge.word,
              knowledge.category,
              related,
              "skipped"
            )
          );
          continue;
        }

        if (related) {
          related.occurrences += 1;
          related.sources = mergeSource(related.sources, update.source);
          related.examples = addExample(
            related.examples,
            update.example,
            this.exampleLimit
          );

          if (update.observationId) {
            related.observationIds = Array.from(
              new Set([...(related.observationIds ?? []), update.observationId])
            );
          }

          updated.push(
            toRelationship(
              knowledge.word,
              knowledge.category,
              related,
              "updated"
            )
          );
          continue;
        }

        related = {
          word: relatedWord,
          category: update.relatedCategory,
          occurrences: 1,
          sources: [update.source],
          examples: addExample([], update.example, this.exampleLimit),
          ...(update.observationId
            ? { observationIds: [update.observationId] }
            : {})
        };

        knowledge.related.push(related);
        added.push(
          toRelationship(
            knowledge.word,
            knowledge.category,
            related,
            "added"
          )
        );
      }

      if (added.length > 0 || updated.length > 0) {
        await this.writeEntries(entries);
        this.entries = entries;
      }

      return { added, updated, skipped };
    });
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const result = this.queue.then(task, task);
    this.queue = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  }

  private async ensureLoaded(): Promise<WordKnowledge[]> {
    if (this.entries) {
      return this.entries;
    }

    if (!this.loading) {
      this.loading = this.readEntries()
        .then((entries) => {
          this.entries = entries;
          return entries;
        })
        .catch((error: unknown) => {
          this.loading = null;
          throw error;
        });
    }

    return this.loading;
  }

  private async readEntries(): Promise<WordKnowledge[]> {
    try {
      const content = await readFile(this.filePath, "utf8");
      return parseStoredKnowledge(JSON.parse(content) as unknown);
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error as NodeJS.ErrnoException).code === "ENOENT"
      ) {
        await this.writeEntries([]);
        return [];
      }

      throw error;
    }
  }

  private async writeEntries(entries: WordKnowledge[]): Promise<void> {
    const directory = path.dirname(this.filePath);
    const temporaryPath = path.join(
      directory,
      `.${path.basename(this.filePath)}.${randomUUID()}.tmp`
    );

    await mkdir(directory, { recursive: true });

    try {
      await writeFile(
        temporaryPath,
        `${JSON.stringify(entries, null, 2)}\n`,
        "utf8"
      );
      await rename(temporaryPath, this.filePath);
    } catch (error) {
      await unlink(temporaryPath).catch(() => undefined);
      throw error;
    }
  }
}
