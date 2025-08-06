const logger = require("./logger");

function handleErrors() {
  // Uncaught exceptions (e.g. throw new Error())
  process.on("uncaughtException", (err) => {
    logger.error(`Uncaught Exception: ${err.stack || err}`);
    process.exit(1);
  });

  // Unhandled promise rejections (e.g. rejected promise without .catch)
  process.on("unhandledRejection", (reason, promise) => {
    logger.error(`Unhandled Rejection: ${reason}`);
  });

  // Optionally catch signals (e.g. Ctrl+C)
  process.on("SIGINT", () => {
    logger.warn("Received SIGINT (Ctrl+C), shutting down...");
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    logger.warn("Received SIGTERM, shutting down...");
    process.exit(0);
  });
}

module.exports = handleErrors;
