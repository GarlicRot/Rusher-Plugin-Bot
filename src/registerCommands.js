// src/registerCommands.js
require("dotenv").config();
const { REST, Routes } = require("discord.js");
const fs = require("fs");
const path = require("path");

const { CLIENT_ID, DISCORD_TOKEN } = process.env;
if (!CLIENT_ID || !DISCORD_TOKEN) {
  console.error("Missing CLIENT_ID or DISCORD_TOKEN in .env");
  process.exit(1);
}

// Collect all command builders from src/commands recursively
function collectCommands(dir, bucket = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectCommands(full, bucket);
    } else if (entry.isFile() && full.endsWith(".js")) {
      const cmd = require(full);
      if (cmd?.data && typeof cmd.execute === "function") {
        bucket.push(cmd.data.toJSON());
        console.log("Prepared command:", cmd.data.name);
      }
    }
  }
  return bucket;
}

const COMMANDS_DIR = path.join(__dirname, "commands");
const commands = fs.existsSync(COMMANDS_DIR) ? collectCommands(COMMANDS_DIR) : [];

const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

(async () => {
  try {
    // Replace GLOBAL commands atomically (no duplicates)
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log(`✓ Registered ${commands.length} GLOBAL commands`);
  } catch (err) {
    console.error("Failed registering global commands:", err);
    process.exit(1);
  }
})();
