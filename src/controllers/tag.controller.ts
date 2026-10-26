import type { RequestHandler } from "express";
import { taggingService } from "../container.js";
import {
  batchTagRequestSchema,
  tagRequestSchema
} from "../schemas/tag.schema.js";

export const tagSentence: RequestHandler = (request, response) => {
  const { sentence } = tagRequestSchema.parse(request.body);
  const result = taggingService.tag(sentence);

  response.status(200).json({ data: result });
};

export const tagSentences: RequestHandler = (request, response) => {
  const { sentences } = batchTagRequestSchema.parse(request.body);
  const results = taggingService.tagBatch(sentences);

  response.status(200).json({
    data: results,
    meta: { count: results.length }
  });
};

export const getVocabulary: RequestHandler = (_request, response) => {
  response.status(200).json({
    data: taggingService.getVocabularyData()
  });
};
