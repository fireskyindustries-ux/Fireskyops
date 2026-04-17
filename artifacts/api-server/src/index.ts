import app from "./app";
import { logger } from "./lib/logger";
import { startScheduler } from "./scheduler";
import { runSeed } from "./lib/seed";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function start() {
  try {
    await runSeed();
  } catch (err) {
    logger.error({ err }, "Startup seed failed — continuing anyway");
  }

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }
    logger.info({ port }, "Server listening");
    startScheduler();
  });
}

start();
