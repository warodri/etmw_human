import type { RequestHandler } from "express";
import {
  generateFromKnowledge,
  getKnowledgeForWord,
  learnKnowledgeSentence,
  learnKnowledgeSentences,
  teachKnowledge
} from "../word-knowledge/index.js";
import {
  generateKnowledgeSchema,
  knowledgeWordParamSchema,
  learnKnowledgeBatchSchema,
  learnKnowledgeSchema,
  teachKnowledgeSchema
} from "../schemas/knowledge.schema.js";

export const teachKnowledgeHandler: RequestHandler = async (
  request,
  response
) => {
  const input = teachKnowledgeSchema.parse(request.body);
  const result = await teachKnowledge(input);

  response.status(200).json({ data: result });
};

export const learnKnowledgeHandler: RequestHandler = async (
  request,
  response
) => {
  const { sentence, observationId } = learnKnowledgeSchema.parse(request.body);
  const result = await learnKnowledgeSentence(sentence, { observationId });

  response.status(200).json({ data: result });
};

export const learnKnowledgeBatchHandler: RequestHandler = async (
  request,
  response
) => {
  const { sentences } = learnKnowledgeBatchSchema.parse(request.body);
  const results = await learnKnowledgeSentences(sentences);

  response.status(200).json({
    data: results,
    meta: { count: results.length }
  });
};

export const getKnowledgeHandler: RequestHandler = async (
  request,
  response
) => {
  const { word } = knowledgeWordParamSchema.parse(request.params);
  const result = await getKnowledgeForWord(word);

  response.status(200).json({ data: result });
};

export const generateKnowledgeHandler: RequestHandler = async (
  request,
  response
) => {
  const { word, maxSentences, seed, ruleId } =
    generateKnowledgeSchema.parse(request.body);
  const result = await generateFromKnowledge(word, {
    maxSentences,
    seed,
    ruleId
  });

  response.status(200).json({ data: result });
};
