require("dotenv").config();

const fs = require("node:fs");
const path = require("node:path");
const { REST, Routes } = require("discord.js");

const PROD_ID = "1402508845582123128";
const { NODE_ENV, CLIENT_ID, GUILD_ID, DISCORD_TOKEN } = process.env;

function fail(message) {
  throw new Error(message);
}

function collectCommands(directory) {
  const commands = [];

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      commands.push(...collectCommands(fullPath));
    } else if (entry.name.endsWith(".js")) {
      const command = require(fullPath);

      if (command?.data && typeof command.execute === "function") {
        commands.push(command.data.toJSON());
      }
    }
  }

  return commands;
}

async function main() {
  if (NODE_ENV !== "development") {
    fail("Development mode is required.");
  }

  if (!DISCORD_TOKEN || !CLIENT_ID || !GUILD_ID) {
    fail("Missing development Discord configuration.");
  }

  if (!/^\d{17,20}$/.test(CLIENT_ID) ||
      !/^\d{17,20}$/.test(GUILD_ID)) {
    fail("Invalid Discord application or server ID.");
  }

  if (CLIENT_ID !== "1563069074236383314" || CLIENT_ID === PROD_ID) {
    fail("Production application is protected.");
  }

  const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

  const application = await rest.get(Routes.currentApplication());

  if (application.id !== CLIENT_ID || application.id === PROD_ID) {
    fail("Token does not belong to the development application.");
  }

  const guild = await rest.get(Routes.guild(GUILD_ID));

  if (guild.id !== "862154341079056464") {
    fail("Target server is not SaFe SpAcE.");
  }

  const commands = collectCommands(
    path.join(__dirname, "../src/commands")
  );

  console.log(`Application: ${application.name}`);
  console.log(`Test server: ${guild.name}`);
  console.log(`Commands: ${commands.length}`);

  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );

  console.log("Development commands registered successfully.");
}

main().catch((error) => {
  console.error("Registration failed:", error.message);
  process.exitCode = 1;
});
