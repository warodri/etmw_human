import { z } from "zod";

const sentenceSchema = z
  .string()
  .min(1, "sentence must not be empty")
  .max(2000, "sentence must be at most 2000 characters")
  .refine((value) => value.trim().length > 0, {
    message: "sentence must not be empty"
  });

export const learnRequestSchema = z.object({
  sentence: sentenceSchema
});

export const learnBatchRequestSchema = z.object({
  sentences: z
    .array(sentenceSchema)
    .min(1, "sentences must contain at least one sentence")
    .max(50, "sentences must contain at most 50 sentences")
});

export const matchRequestSchema = z.object({
  sentence: sentenceSchema
});

export const generateRequestSchema = z.object({
  ruleId: z.string().trim().min(1, "ruleId must not be empty"),
  seed: z.number().int().optional(),
  words: z
    .array(
      z
        .string()
        .trim()
        .min(1, "words must not contain empty entries")
        .max(200, "words must be at most 200 characters")
    )
    .max(100, "words must contain at most 100 entries")
    .optional()
});

export const generateRandomRequestSchema = z.object({
  seed: z.number().int().optional()
});
