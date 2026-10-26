import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().max(65535).default(3450),
  CORS_ORIGIN: z.string().min(1).default("*"),
  LEXICON_DRIVER: z.enum(["memory"]).default("memory"),
  KNOWLEDGE_DRIVER: z.enum(["json"]).default("json"),
  WORD_KNOWLEDGE_FILE: z.string().optional(),
  KNOWLEDGE_EXAMPLE_LIMIT: z.coerce.number().int().positive().default(5)
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(`Invalid environment configuration: ${parsed.error.message}`);
}

export const env = {
  nodeEnv: parsed.data.NODE_ENV,
  port: parsed.data.PORT,
  corsOrigin: parsed.data.CORS_ORIGIN,
  lexiconDriver: parsed.data.LEXICON_DRIVER,
  knowledgeDriver: parsed.data.KNOWLEDGE_DRIVER,
  wordKnowledgeFile: parsed.data.WORD_KNOWLEDGE_FILE,
  knowledgeExampleLimit: parsed.data.KNOWLEDGE_EXAMPLE_LIMIT,
  isTest: parsed.data.NODE_ENV === "test"
};
