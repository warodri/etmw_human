import type { RequestHandler } from "express";
import {
  generateFromRule,
  generateRandomSentence,
  getRules,
  getVocabularyArrays,
  learnSentence,
  learnSentences,
  matchSentence
} from "../sentence-learning/index.js";
import {
  generateRandomRequestSchema,
  generateRequestSchema,
  learnBatchRequestSchema,
  learnRequestSchema,
  matchRequestSchema
} from "../schemas/learning.schema.js";

export const learnOne: RequestHandler = async (request, response) => {
  const { sentence } = learnRequestSchema.parse(request.body);
  const result = await learnSentence(sentence);

  response.status(200).json({ data: result });
};

export const learnMany: RequestHandler = async (request, response) => {
  const { sentences } = learnBatchRequestSchema.parse(request.body);
  const results = await learnSentences(sentences);

  response.status(200).json({
    data: results,
    meta: { count: results.length }
  });
};

export const listRules: RequestHandler = async (_request, response) => {
  const rules = await getRules();

  response.status(200).json({
    data: { rules, count: rules.length }
  });
};

export const matchOne: RequestHandler = async (request, response) => {
  const { sentence } = matchRequestSchema.parse(request.body);
  const result = await matchSentence(sentence);

  response.status(200).json({ data: result });
};

export const generateOne: RequestHandler = async (request, response) => {
  const { ruleId, seed, words } = generateRequestSchema.parse(request.body);
  const result = await generateFromRule(ruleId, { seed, words });

  response.status(200).json({ data: result });
};

export const generateRandom: RequestHandler = async (request, response) => {
  const { seed } = generateRandomRequestSchema.parse(request.body ?? {});
  const result = await generateRandomSentence({ seed });

  response.status(200).json({ data: result });
};

export const listVocabularyArrays: RequestHandler = (
  _request,
  response
) => {
  const arrays = getVocabularyArrays();

  response.status(200).json({
    data: { arrays, count: arrays.length }
  });
};
