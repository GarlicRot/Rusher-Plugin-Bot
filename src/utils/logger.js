const chalk = require("chalk");

const timestamp = () => `[${new Date().toISOString()}]`;

const logger = {
  info: (msg) => console.log(`${timestamp()} ${chalk.blue("[INFO]")} ${msg}`),
  warn: (msg) =>
    console.warn(`${timestamp()} ${chalk.yellow("[WARN]")} ${msg}`),
  error: (msg) =>
    console.error(`${timestamp()} ${chalk.red("[ERROR]")} ${msg}`),
  success: (msg) =>
    console.log(`${timestamp()} ${chalk.green("[SUCCESS]")} ${msg}`),
  debug: (msg) => {
    if (process.env.DEBUG === "true") {
      console.debug(`${timestamp()} ${chalk.magenta("[DEBUG]")} ${msg}`);
    }
  },
};

module.exports = logger;
