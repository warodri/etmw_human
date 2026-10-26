import { Router } from "express";
import {
  generateKnowledgeHandler,
  getKnowledgeHandler,
  learnKnowledgeBatchHandler,
  learnKnowledgeHandler,
  teachKnowledgeHandler
} from "../controllers/knowledge.controller.js";

export const knowledgeRoutes = Router();

knowledgeRoutes.post("/teach", teachKnowledgeHandler);
knowledgeRoutes.post("/learn", learnKnowledgeHandler);
knowledgeRoutes.post("/learn/batch", learnKnowledgeBatchHandler);
knowledgeRoutes.post("/generate", generateKnowledgeHandler);
knowledgeRoutes.get("/:word", getKnowledgeHandler);
