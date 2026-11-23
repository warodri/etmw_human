import { Router } from "express";
import {
  generateKnowledgeHandler,
  getKnowledgeHandler,
  learnKnowledgeBatchHandler,
  listKnowledgeHandler,
  learnKnowledgeHandler,
  teachKnowledgeHandler
} from "../controllers/knowledge.controller.js";

export const knowledgeRoutes = Router();

knowledgeRoutes.post("/teach", teachKnowledgeHandler);
knowledgeRoutes.post("/learn", learnKnowledgeHandler);
knowledgeRoutes.post("/learn/batch", learnKnowledgeBatchHandler);
knowledgeRoutes.post("/generate", generateKnowledgeHandler);
knowledgeRoutes.get("/", listKnowledgeHandler);
knowledgeRoutes.get("/:word", getKnowledgeHandler);
