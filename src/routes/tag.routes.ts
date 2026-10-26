import { Router } from "express";
import {
  getVocabulary,
  tagSentence,
  tagSentences
} from "../controllers/tag.controller.js";

export const tagRoutes = Router();

tagRoutes.post("/tag", tagSentence);
tagRoutes.post("/tag/batch", tagSentences);
tagRoutes.get("/vocabulary", getVocabulary);
