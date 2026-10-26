import { Router } from "express";
import { knowledgeRoutes } from "./knowledge.routes.js";
import { learningRoutes } from "./learning.routes.js";
import { tagRoutes } from "./tag.routes.js";

export const apiRouter = Router();

apiRouter.get("/api", (_request, response) => {
  response.status(200).json({
    name: "etmw-server",
    description: "English part-of-speech tagging API",
    version: "1.0.0",
    endpoints: {
      health: "GET /health",
      tag: "POST /api/v1/tag",
      batchTag: "POST /api/v1/tag/batch",
      vocabulary: "GET /api/v1/vocabulary",
      learn: "POST /api/v1/learning/learn",
      rules: "GET /api/v1/learning/rules",
      match: "POST /api/v1/learning/match",
      generate: "POST /api/v1/learning/generate",
      knowledgeTeach: "POST /api/v1/knowledge/teach",
      knowledgeLearn: "POST /api/v1/knowledge/learn",
      knowledgeWord: "GET /api/v1/knowledge/:word",
      knowledgeGenerate: "POST /api/v1/knowledge/generate"
    }
  });
});

apiRouter.get("/health", (_request, response) => {
  response.status(200).json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

apiRouter.use("/api/v1", tagRoutes);
apiRouter.use("/api/v1/learning", learningRoutes);
apiRouter.use("/api/v1/knowledge", knowledgeRoutes);
