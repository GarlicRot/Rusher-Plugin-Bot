require("dotenv").config();
const { REST, Routes } = require("discord.js");
const fs = require("fs");
const path = require("path");
const logger = require("./utils/logger");

// Validate required ENV
const { CLIENT_ID, GUILD_ID, DISCORD_TOKEN } = process.env;
if (!CLIENT_ID || !GUILD_ID || !DISCORD_TOKEN) {
  logger.error("Missing CLIENT_ID, GUILD_ID, or DISCORD_TOKEN in .env");
  process.exit(1);
}

const commands = [];

// Recursively get all command files
function getCommandFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      getCommandFiles(fullPath);
    } else if (entry.isFile() && fullPath.endsWith(".js")) {
      const command = require(fullPath);
      if (command?.data && typeof command.execute === "function") {
        commands.push(command.data.toJSON());
        logger.info(`Prepared command: ${command.data.name}`);
      } else {
        logger.warn(`Skipped invalid command: ${fullPath}`);
      }
    }
  }
}

getCommandFiles(path.join(__dirname, "commands"));

const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

(async () => {
  try {
    logger.info("Registering slash commands...");

    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
      body: commands,
    });

    logger.success("Slash commands registered successfully.");
  } catch (error) {
    logger.error(`Failed to register commands: ${error}`);
  }
})();
