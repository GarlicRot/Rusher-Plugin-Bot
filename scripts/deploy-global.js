// scripts/deploy-global.js
require("dotenv").config();
const { REST, Routes } = require("discord.js");
const fs = require("fs");
const path = require("path");

const { CLIENT_ID, DISCORD_TOKEN } = process.env;
if (!CLIENT_ID || !DISCORD_TOKEN) {
  console.error("Missing CLIENT_ID or DISCORD_TOKEN");
  process.exit(1);
}

function collect(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collect(full, out);
    else if (entry.isFile() && full.endsWith(".js")) {
      const c = require(full);
      if (c?.data && typeof c.execute === "function") out.push(c.data.toJSON());
    }
  }
  return out;
}

const commands = collect(path.join(__dirname, "../src/commands"));
const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

(async () => {
  // Replace global set atomically (no duplicates)
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
  console.log(`✓ Registered ${commands.length} GLOBAL commands`);
})();
