// src/nukeGuildCommands.js
require("dotenv").config();
const { REST, Routes } = require("discord.js");

const { CLIENT_ID, DISCORD_TOKEN, GUILD_ID } = process.env;
if (!CLIENT_ID || !DISCORD_TOKEN) {
  console.error("Missing CLIENT_ID or DISCORD_TOKEN in .env");
  process.exit(1);
}

const guildIds = (GUILD_ID || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

if (guildIds.length === 0) {
  console.error("No GUILD_ID provided. Add one or more (comma-separated) to .env");
  process.exit(1);
}

const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

(async () => {
  try {
    for (const gid of guildIds) {
      await rest.put(Routes.applicationGuildCommands(CLIENT_ID, gid), { body: [] });
      console.log(`✓ Cleared guild commands in ${gid}`);
    }
    console.log("✓ Done nuking guild commands");
  } catch (err) {
    console.error("Failed nuking guild commands:", err);
    process.exit(1);
  }
})();
