// src/utils/errorHandler.js
const logger = require("./logger");

function handleErrors() {
  // Uncaught exceptions (e.g. throw new Error())
  process.on("uncaughtException", (err) => {
    const msg = err && err.stack ? err.stack : String(err);
    logger.error("===== Uncaught Exception =====");
    logger.error(msg);
    logger.error("===== End Uncaught Exception =====");

  });

  // Unhandled promise rejections (e.g. rejected promise without .catch)
  process.on("unhandledRejection", (reason, promise) => {
    const msg =
      reason && reason.stack
        ? reason.stack
        : typeof reason === "object"
        ? JSON.stringify(reason)
        : String(reason);

    logger.error("===== Unhandled Rejection =====");
    logger.error(msg);
    logger.error("===== End Unhandled Rejection =====");
  });

  // Graceful shutdown on signals (e.g. Ctrl+C, container stop)
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
