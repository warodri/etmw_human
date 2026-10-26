import { z } from "zod";

export const tagRequestSchema = z.object({
  sentence: z
    .string()
    .trim()
    .min(1, "sentence must not be empty")
    .max(1000, "sentence must be at most 1000 characters")
});

export const batchTagRequestSchema = z.object({
  sentences: z
    .array(
      z
        .string()
        .trim()
        .min(1, "sentence must not be empty")
        .max(1000, "sentence must be at most 1000 characters")
    )
    .min(1, "sentences must contain at least one sentence")
    .max(50, "sentences must contain at most 50 sentences")
});

export type TagRequest = z.infer<typeof tagRequestSchema>;
export type BatchTagRequest = z.infer<typeof batchTagRequestSchema>;
