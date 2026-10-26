import { app } from "./app.js";
import { env } from "./config/env.js";

const server = app.listen(env.port, () => {
  console.log(`etmw-server listening on port ${env.port} (${env.nodeEnv})`);
});

server.on("error", (error) => {
  console.error("Server failed to start", error);
  process.exitCode = 1;
});

function shutdown(signal: NodeJS.Signals): void {
  console.log(`${signal} received, shutting down`);

  server.close((error) => {
    if (error) {
      console.error("Error while closing the server", error);
      process.exitCode = 1;
    }
  });

  setTimeout(() => {
    process.exit(1);
  }, 10000).unref();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
