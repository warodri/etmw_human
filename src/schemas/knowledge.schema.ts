import { z } from "zod";

const sentenceSchema = z
  .string()
  .min(1, "sentence must not be empty")
  .max(2000, "sentence must be at most 2000 characters")
  .refine((value) => value.trim().length > 0, {
    message: "sentence must not be empty"
  });

const wordSchema = z
  .string()
  .trim()
  .min(1, "word must not be empty")
  .max(200, "word must be at most 200 characters");

const categorySchema = z
  .string()
  .trim()
  .min(1, "category must not be empty")
  .max(100, "category must be at most 100 characters");

const observationIdSchema = z
  .string()
  .trim()
  .min(1, "observationId must not be empty")
  .max(200, "observationId must be at most 200 characters");

export const teachKnowledgeSchema = z.object({
  word: wordSchema,
  category: categorySchema,
  related: z
    .array(
      z.object({
        word: wordSchema,
        category: categorySchema
      })
    )
    .min(1, "related must contain at least one entry")
    .max(100, "related must contain at most 100 entries"),
  observationId: observationIdSchema.optional()
});

export const learnKnowledgeSchema = z.object({
  sentence: sentenceSchema,
  observationId: observationIdSchema.optional()
});

export const learnKnowledgeBatchSchema = z.object({
  sentences: z
    .array(sentenceSchema)
    .min(1, "sentences must contain at least one sentence")
    .max(50, "sentences must contain at most 50 sentences")
});

export const knowledgeWordParamSchema = z.object({
  word: z
    .string()
    .trim()
    .min(1, "word must not be empty")
    .max(200, "word must be at most 200 characters")
});

export const generateKnowledgeSchema = z.object({
  word: wordSchema,
  maxSentences: z.number().int().min(1).max(20).optional(),
  seed: z.number().int().optional(),
  ruleId: z.string().trim().min(1).max(100).optional()
});
