import app from "./app";
import { logger } from "./lib/logger";
import { startNgrok } from "./lib/ngrok";

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

app.listen(port, async () => {
  logger.info({ port }, "Server listening");

  if (process.env.NGROK_AUTHTOKEN) {
    logger.info("Starting ngrok tunnel...");
    try {
      const url = await startNgrok();
      if (url) {
        logger.info({ url }, "Ngrok tunnel active");
      } else {
        logger.warn("Ngrok tunnel could not be established.");
      }
    } catch (err) {
      logger.error({ err }, "Ngrok startup error — server will continue without tunnel.");
    }
  } else {
    logger.info("NGROK_AUTHTOKEN not set — skipping ngrok startup.");
  }
});

process.on("SIGTERM", async () => {
  logger.info("SIGTERM received — shutting down gracefully.");
  const { stopNgrok } = await import("./lib/ngrok");
  await stopNgrok();
  process.exit(0);
});

process.on("SIGINT", async () => {
  logger.info("SIGINT received — shutting down gracefully.");
  const { stopNgrok } = await import("./lib/ngrok");
  await stopNgrok();
  process.exit(0);
});

process.on("uncaughtException", (err) => {
  logger.error({ err }, "Uncaught exception");
});

process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "Unhandled promise rejection");
});
