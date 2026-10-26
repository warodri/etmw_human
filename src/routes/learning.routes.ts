import { Router } from "express";
import {
  generateOne,
  generateRandom,
  learnMany,
  learnOne,
  listRules,
  listVocabularyArrays,
  matchOne
} from "../controllers/learning.controller.js";

export const learningRoutes = Router();

learningRoutes.post("/learn", learnOne);
learningRoutes.post("/learn/batch", learnMany);
learningRoutes.get("/rules", listRules);
learningRoutes.post("/match", matchOne);
learningRoutes.post("/generate", generateOne);
learningRoutes.post("/generate/random", generateRandom);
learningRoutes.get("/vocabulary", listVocabularyArrays);
