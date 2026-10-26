import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { VocabularyCategory } from "../data/vocabulary.js";
import type { LearnedRule } from "./types.js";

interface UpsertResult {
  created: LearnedRule[];
  existing: LearnedRule[];
}

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(moduleDirectory, "../..");

export function resolveRulesPath(): string {
  const configured = process.env.LEARNED_RULES_FILE;

  return configured
    ? path.resolve(configured)
    : path.join(projectRoot, "data", "learned-rules.json");
}

function cloneRule(rule: LearnedRule): LearnedRule {
  return structuredClone(rule);
}

function parseStoredRules(value: unknown): LearnedRule[] {
  if (!Array.isArray(value)) {
    throw new Error("Learned rules file must contain a JSON array.");
  }

  return value.map((entry, position) => {
    if (!entry || typeof entry !== "object") {
      throw new Error(`Invalid learned rule at position ${position}.`);
    }

    const record = entry as Record<string, unknown>;
    const { id, pattern, examples, count, separators } = record;

    if (typeof id !== "string" || id.length === 0) {
      throw new Error(`Invalid learned rule id at position ${position}.`);
    }

    if (
      !Array.isArray(pattern) ||
      !pattern.every((category) => typeof category === "string")
    ) {
      throw new Error(`Invalid pattern for learned rule ${id}.`);
    }

    if (
      !Array.isArray(examples) ||
      !examples.every((example) => typeof example === "string")
    ) {
      throw new Error(`Invalid examples for learned rule ${id}.`);
    }

    if (typeof count !== "number" || !Number.isFinite(count)) {
      throw new Error(`Invalid count for learned rule ${id}.`);
    }

    if (
      separators !== undefined &&
      (!Array.isArray(separators) ||
        !separators.every((separator) => typeof separator === "string"))
    ) {
      throw new Error(`Invalid separators for learned rule ${id}.`);
    }

    return {
      id,
      pattern: [...pattern] as VocabularyCategory[],
      examples: [...examples],
      count,
      ...(separators ? { separators: [...separators] } : {})
    };
  });
}

export class RuleStore {
  private rules: LearnedRule[] | null = null;
  private loading: Promise<LearnedRule[]> | null = null;
  private queue: Promise<void> = Promise.resolve();

  constructor(private readonly filePath: string = resolveRulesPath()) {}

  async getRules(): Promise<LearnedRule[]> {
    const rules = await this.ensureLoaded();
    return rules.map(cloneRule);
  }

  async getRule(ruleId: string): Promise<LearnedRule | undefined> {
    const rules = await this.ensureLoaded();
    const rule = rules.find((entry) => entry.id === ruleId);
    return rule ? cloneRule(rule) : undefined;
  }

  async upsertPatterns(
    patterns: VocabularyCategory[][],
    example: string,
    separators: string[]
  ): Promise<UpsertResult> {
    return this.enqueue(async () => {
      if (patterns.length === 0) {
        return { created: [], existing: [] };
      }

      const current = await this.ensureLoaded();
      const rules = current.map(cloneRule);
      const created: LearnedRule[] = [];
      const existing: LearnedRule[] = [];
      const seenPatterns = new Set<string>();
      const nextId = this.createIdFactory(rules);

      for (const pattern of patterns) {
        const key = JSON.stringify(pattern);

        if (seenPatterns.has(key)) {
          continue;
        }

        seenPatterns.add(key);

        const stored = rules.find(
          (entry) => JSON.stringify(entry.pattern) === key
        );

        if (stored) {
          stored.count += 1;

          if (!stored.examples.includes(example)) {
            stored.examples.push(example);
          }

          if (!stored.separators && separators.length === pattern.length + 1) {
            stored.separators = [...separators];
          }

          existing.push(stored);
          continue;
        }

        const rule: LearnedRule = {
          id: nextId(),
          pattern: [...pattern],
          examples: [example],
          count: 1,
          ...(separators.length === pattern.length + 1
            ? { separators: [...separators] }
            : {})
        };

        rules.push(rule);
        created.push(rule);
      }

      await this.writeRules(rules);
      this.rules = rules;

      return {
        created: created.map(cloneRule),
        existing: existing.map(cloneRule)
      };
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

  private createIdFactory(rules: LearnedRule[]): () => string {
    let maximum = 0;

    for (const rule of rules) {
      const match = /^rule_(\d+)$/.exec(rule.id);

      if (match) {
        maximum = Math.max(maximum, Number(match[1]));
      }
    }

    let next = maximum + 1;

    return () => `rule_${String(next++).padStart(3, "0")}`;
  }

  private async ensureLoaded(): Promise<LearnedRule[]> {
    if (this.rules) {
      return this.rules;
    }

    if (!this.loading) {
      this.loading = this.readRules()
        .then((rules) => {
          this.rules = rules;
          return rules;
        })
        .catch((error: unknown) => {
          this.loading = null;
          throw error;
        });
    }

    return this.loading;
  }

  private async readRules(): Promise<LearnedRule[]> {
    try {
      const content = await readFile(this.filePath, "utf8");
      return parseStoredRules(JSON.parse(content) as unknown);
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error as NodeJS.ErrnoException).code === "ENOENT"
      ) {
        return [];
      }

      throw error;
    }
  }

  private async writeRules(rules: LearnedRule[]): Promise<void> {
    const directory = path.dirname(this.filePath);
    const temporaryPath = path.join(
      directory,
      `.${path.basename(this.filePath)}.${randomUUID()}.tmp`
    );

    await mkdir(directory, { recursive: true });

    try {
      await writeFile(
        temporaryPath,
        `${JSON.stringify(rules, null, 2)}\n`,
        "utf8"
      );
      await rename(temporaryPath, this.filePath);
    } catch (error) {
      await unlink(temporaryPath).catch(() => undefined);
      throw error;
    }
  }
}

export const defaultRuleStore = new RuleStore();
