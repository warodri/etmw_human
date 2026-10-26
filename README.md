# ETMW Human

TypeScript + Express experiment for learning sentence category sequences and
word relationships from examples. It is not a grammar checker and does not
score, validate, or infer facts.

## Setup

```bash
npm install
npm run seed:knowledge
npm run dev
```

The server runs on **http://localhost:3450**. For a production-style start:

```bash
npm run build
npm start
```

## Verification

```bash
npm test
npm run lint
npm run typecheck
```

The test suite uses temporary JSON stores and never mutates the checked-in data.

## Existing APIs

All previous endpoints remain available, including:

- `POST /api/v1/tag`
- `POST /api/v1/learning/learn`
- `GET /api/v1/learning/rules`
- `POST /api/v1/learning/match`
- `POST /api/v1/learning/generate`
- `GET /api/v1/learning/vocabulary`

`POST /api/v1/learning/learn` intentionally remains **rule-only** for backward
compatibility. The combined rule + relationship endpoint is
`POST /api/v1/knowledge/learn`.

## Knowledge APIs

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/v1/knowledge/teach` | Directly teach focus → related connections |
| POST | `/api/v1/knowledge/learn` | Learn sentence rules and extract supported connections |
| POST | `/api/v1/knowledge/learn/batch` | Process multiple sentences |
| GET | `/api/v1/knowledge/:word` | Read forward connections for a word |
| POST | `/api/v1/knowledge/generate` | Build sentences from a focus word, stored connection, and learned rule |

### Teach

```bash
curl -s http://localhost:3450/api/v1/knowledge/teach \
  -H 'Content-Type: application/json' \
  -d '{
    "word": "sky",
    "category": "nouns",
    "related": [{"word": "blue", "category": "adjectives"}]
  }'
```

Response shape:

```json
{
  "data": {
    "word": "sky",
    "category": "nouns",
    "added": [
      {
        "focusWord": "sky",
        "focusCategory": "nouns",
        "relatedWord": "blue",
        "relatedCategory": "adjectives",
        "occurrences": 1,
        "sources": ["direct"],
        "action": "added"
      }
    ],
    "updated": [],
    "skipped": [],
    "unknown": []
  }
}
```

Invalid words or categories are returned inside `unknown`; the vocabulary
arrays are never edited automatically.

### Learn

```bash
curl -s http://localhost:3450/api/v1/knowledge/learn \
  -H 'Content-Type: application/json' \
  -d '{"sentence": "The sky is blue."}'
```

Example response:

```json
{
  "data": {
    "input": "The sky is blue.",
    "learned": [
      {
        "id": "rule_037",
        "pattern": ["articles", "nouns", "auxiliaryVerbs", "adjectives"],
        "examples": ["The sky is blue."],
        "count": 1
      }
    ],
    "existingRuleIds": ["rule_038"],
    "unknownTokens": [],
    "truncated": false,
    "relationshipsLearned": [
      {
        "focusWord": "sky",
        "focusCategory": "nouns",
        "relatedWord": "blue",
        "relatedCategory": "adjectives",
        "occurrences": 2,
        "sources": ["direct", "sentence"],
        "action": "updated"
      }
    ],
    "relationshipsSkipped": []
  }
}
```

All normal `LearningResult` fields are preserved, plus
`relationshipsLearned`, `relationshipsSkipped`, and an optional
`relationshipReason` / `relationshipError`.

### Query

```bash
curl -s http://localhost:3450/api/v1/knowledge/sky
```

Example response:

```json
{
  "data": {
    "word": "sky",
    "catalogueCategories": ["nouns"],
    "entries": [
      {
        "word": "sky",
        "category": "nouns",
        "related": [
          {
            "word": "blue",
            "category": "adjectives",
            "occurrences": 2,
            "sources": ["direct", "sentence"],
            "examples": ["The sky is blue."]
          }
        ]
      }
    ]
  }
}
```

`GET /api/v1/knowledge/blue` returns no `blue → sky` relationship: reverse facts
are not asserted automatically.

### Generate

```bash
curl -s http://localhost:3450/api/v1/knowledge/generate \
  -H 'Content-Type: application/json' \
  -d '{"word": "sky", "maxSentences": 3, "seed": 42}'
```

Example response:

```json
{
  "data": {
    "focusWord": "sky",
    "sentences": [
      {
        "sentence": "The sky is blue.",
        "ruleId": "rule_037",
        "pattern": ["articles", "nouns", "auxiliaryVerbs", "adjectives"],
        "words": ["The", "sky", "is", "blue"],
        "relatedWord": "blue",
        "relatedCategory": "adjectives",
        "source": "learned-relationship"
      }
    ]
  }
}
```

Each result includes the sentence, rule ID, pattern, chosen words, related word,
related category, and `"source": "learned-relationship"`. Generated output is
never written back into knowledge.

## Persistence and MongoDB migration

JSON files:

```text
data/learned-rules.json    sentence rules
data/word-knowledge.json   word → category → related words
src/data/knowledge-seed.json
```

Configuration:

```text
LEARNED_RULES_FILE=
LEARNING_PATTERN_CAP=100
WORD_KNOWLEDGE_FILE=
KNOWLEDGE_EXAMPLE_LIMIT=5
KNOWLEDGE_DRIVER=json
```

The JSON repository validates its file, creates missing files/directories,
serialises writes through a queue, and uses temp-file + rename writes. It is
designed for a single server instance; multi-instance deployments should use
MongoDB.

Storage is behind this interface:

```ts
interface KnowledgeRepository {
  getByWord(word: string): Promise<WordKnowledge[]>;
  getByWordAndCategory(
    word: string,
    category: VocabularyCategory
  ): Promise<WordKnowledge | undefined>;
  upsertRelationships(
    updates: KnowledgeRelationshipInput[]
  ): Promise<RepositoryUpsertSummary>;
  list(options?: KnowledgeQueryOptions): Promise<WordKnowledge[]>;
}
```

Implement the same interface as `MongoKnowledgeRepository`, register it in
`knowledge-repository.factory.ts`, and switch `KNOWLEDGE_DRIVER`. Controllers
and services do not contain file or database code.

## Seed data

```bash
npm run seed:knowledge
```

The seed is idempotent: direct relationships use observation IDs, sentence
relationships use deterministic observation IDs, and rule examples already in
storage are not re-counted. It does not reset user data.

It includes 23 sentences (the required 15 plus additional structures), 9 direct
relationship groups, and enough category patterns to preload more than 12
distinct rules on an empty store. All tokens used by the seed exist in the
current vocabulary arrays, so **there are no missing catalogue words** for this
seed set. No vocabulary array was modified.

## Relationship extraction

Sentence extraction is deliberately narrow. It only records a connection when
an observed category sequence matches a configured template, currently:

- `articles → nouns → auxiliaryVerbs/mainVerbs → adjectives` (noun → adjective)
- `articles → nouns → auxiliaryVerbs/mainVerbs → articles → nouns` (noun → noun)

Unmatched sentences still learn their sentence rules and return an empty
relationship list with a reason. No grammar, fluency, semantic, or invention
layer is present.

## Licensing

ETMW Human is **source-available** software. It is free to use for
non-commercial purposes under the [PolyForm Noncommercial License 1.0.0](LICENSE.md).
The source code is available for inspection, experimentation, modification, and
sharing, subject to the terms of that license.

Commercial use requires a separate paid licence agreement with the copyright
holder. See [COMMERCIAL.md](COMMERCIAL.md) and
<https://entertomyworld.com> for commercial licensing enquiries.

Copyright © 2026 Walter Rodriguez.

Required Notice: Copyright 2026 Walter Rodriguez.

The PolyForm Noncommercial License 1.0.0 text is reproduced from the official
PolyForm Project source and is © PolyForm Project Inc. Its terms are not
replaced or modified by this project.

### Third-party dependencies

This repository does not vendor third-party source code outside the npm
dependency packages. Those packages remain subject to their own licenses and
copyright notices, which are not replaced by the project licence.

Direct runtime dependencies:

- `cors` — MIT
- `dotenv` — BSD-2-Clause
- `express` — MIT
- `helmet` — MIT
- `morgan` — MIT
- `zod` — MIT

Direct development dependencies include MIT-licensed packages, plus
`typescript` under Apache-2.0. The full development dependency tree also
includes Apache-2.0, ISC, BSD, BlueOak-1.0.0, and MPL-2.0 packages. In
particular, `lightningcss` (used by the development toolchain) is MPL-2.0.
Those packages are not vendored into this repository; their own license and
copyright notices remain in the installed packages. Package metadata in
`package-lock.json` identifies the applicable packages and versions.
