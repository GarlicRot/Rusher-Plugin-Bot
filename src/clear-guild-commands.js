require("dotenv").config();
const { REST, Routes } = require("discord.js");
const logger = require("./utils/logger");

// Validate required ENV
const { CLIENT_ID, DISCORD_TOKEN, GUILD_ID } = process.env;
if (!CLIENT_ID || !DISCORD_TOKEN) {
  logger.error("Missing CLIENT_ID or DISCORD_TOKEN in .env");
  process.exit(1);
}

// Parse GUILD_IDS (comma-separated string or single ID)
const guildIds = GUILD_ID ? GUILD_ID.split(",").map((id) => id.trim()) : [];

if (guildIds.length === 0) {
  logger.error("No GUILD_IDS specified in .env");
  process.exit(1);
}

const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

(async () => {
  try {
    logger.info(
      `Clearing guild-specific commands for ${guildIds.length} guild(s)...`
    );

    for (const guildId of guildIds) {
      try {
        await rest.put(Routes.applicationGuildCommands(CLIENT_ID, guildId), {
          body: [],
        });
        logger.info(`Successfully cleared commands for guild ${guildId}`);
      } catch (error) {
        logger.error(
          `Failed to clear commands for guild ${guildId}: ${error.message}`
        );
      }
    }

    logger.success("Finished clearing guild-specific commands.");
  } catch (error) {
    logger.error(`Unexpected error during command clearing: ${error}`);
    process.exit(1);
  }
})();
