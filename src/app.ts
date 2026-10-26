import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { requestId } from "./middleware/request-id.js";
import { apiRouter } from "./routes/index.js";

const publicDirectory = fileURLToPath(new URL("../public", import.meta.url));

export function createApp(): express.Express {
  const app = express();

  app.disable("x-powered-by");
  app.use(requestId);
  app.use(helmet());
  app.use(
    cors({
      origin:
        env.corsOrigin === "*"
          ? "*"
          : env.corsOrigin.split(",").map((origin) => origin.trim())
    })
  );
  app.use(express.json({ limit: "100kb" }));

  if (!env.isTest) {
    app.use(morgan("combined"));
  }

  app.use(express.static(publicDirectory, { extensions: ["html"] }));
  app.use(apiRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export const app = createApp();
