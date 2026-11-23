import { normalizePhrase } from "../sentence-learning/category-matcher.js";
import type { KnowledgeRepository } from "./knowledge-repository.js";
import type {
  KnowledgeEntryCategory,
  RelatedWord,
  ResolvedKnowledge,
  ResolvedRelationship,
  WordKnowledge
} from "./types.js";

export function resolveMaxDepth(): number {
  const configured = Number(
    process.env.KNOWLEDGE_MAX_RESOLUTION_DEPTH ?? 10
  );

  return Number.isInteger(configured) && configured > 0 ? configured : 10;
}

function entryKey(entry: WordKnowledge): string {
  return JSON.stringify([normalizePhrase(entry.word), entry.category]);
}

function relationshipKey(
  word: string,
  category: ResolvedRelationship["category"]
): string {
  return JSON.stringify([normalizePhrase(word), category]);
}

function samePath(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    left.every((part, index) => part === right[index])
  );
}

export class KnowledgeResolver {
  constructor(
    private readonly repository: KnowledgeRepository,
    private readonly maxDepth: number = resolveMaxDepth()
  ) {}

  async resolve(
    word: string,
    category?: KnowledgeEntryCategory
  ): Promise<ResolvedKnowledge[]> {
    const entries = await this.repository.getByWord(word);
    const matching = category
      ? entries.filter((entry) => entry.category === category)
      : entries;

    return Promise.all(
      matching.map((entry) =>
        this.resolveEntry(
          entry,
          new Set([entryKey(entry)]),
          0,
          [entry.word]
        )
      )
    );
  }

  private async resolveEntry(
    entry: WordKnowledge,
    visited: Set<string>,
    depth: number,
    trail: string[]
  ): Promise<ResolvedKnowledge> {
    const effective = new Map<string, ResolvedRelationship>();
    const directKeys = new Set<string>();
    const warnings: string[] = [];
    const warningSet = new Set<string>();

    const warn = (message: string): void => {
      if (!warningSet.has(message)) {
        warningSet.add(message);
        warnings.push(message);
      }
    };

    const addDirect = (related: RelatedWord): void => {
      if (related.category === "system") {
        return;
      }

      const key = relationshipKey(related.word, related.category);
      directKeys.add(key);

      if (effective.has(key)) {
        return;
      }

      effective.set(key, {
        word: related.word,
        category: related.category,
        origin: "direct"
      });
    };

    const addInherited = (
      targetEntry: WordKnowledge,
      inherited: ResolvedRelationship
    ): void => {
      const key = relationshipKey(inherited.word, inherited.category);

      if (directKeys.has(key)) {
        return;
      }

      const targetPath = inherited.path ?? [targetEntry.word];
      const path = [entry.word, ...targetPath];
      const inheritedFrom = path[path.length - 1] ?? targetEntry.word;
      const existing = effective.get(key);

      if (existing) {
        if (existing.origin === "inherited") {
          const paths = existing.alternativePaths ?? [];

          if (
            !samePath(existing.path ?? [], path) &&
            !paths.some((candidate) => samePath(candidate, path))
          ) {
            existing.alternativePaths = [...paths, path];
          }
        }

        return;
      }

      effective.set(key, {
        word: inherited.word,
        category: inherited.category,
        origin: "inherited",
        inheritedFrom,
        path
      });
    };

    for (const related of entry.related) {
      addDirect(related);
    }

    for (const related of entry.related) {
      if (related.category !== "system") {
        continue;
      }

      const targetWord = related.word.trim();
      const targetEntries = await this.repository.getByWord(targetWord);

      if (targetEntries.length === 0) {
        warn(
          `System reference "${related.word}" from "${entry.word}" could not be resolved: no matching knowledge entry was found.`
        );
        continue;
      }

      for (const targetEntry of targetEntries) {
        const key = entryKey(targetEntry);

        if (visited.has(key)) {
          warn(
            `System reference cycle detected: ${[...trail, targetEntry.word].join(" → ")}.`
          );
          continue;
        }

        if (depth >= this.maxDepth) {
          warn(
            `Maximum system resolution depth (${this.maxDepth}) reached while resolving "${entry.word}" → "${targetEntry.word}".`
          );
          continue;
        }

        const nextVisited = new Set(visited);
        nextVisited.add(key);
        const resolved = await this.resolveEntry(
          targetEntry,
          nextVisited,
          depth + 1,
          [...trail, targetEntry.word]
        );

        for (const warning of resolved.warnings) {
          warn(`Via "${targetEntry.word}": ${warning}`);
        }

        for (const inherited of resolved.effective) {
          addInherited(targetEntry, inherited);
        }
      }
    }

    return {
      word: entry.word,
      category: entry.category,
      direct: [...entry.related],
      effective: Array.from(effective.values()),
      warnings
    };
  }
}
