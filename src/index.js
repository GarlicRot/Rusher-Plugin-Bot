require("dotenv").config();
const { Client, GatewayIntentBits, Collection } = require("discord.js");
const fs = require("fs");
const path = require("path");
const logger = require("./utils/logger");
const handleErrors = require("./utils/errorHandler");
const { loadPluginData } = require("./utils/dataStore");
handleErrors();

// Validate environment variables
if (!process.env.DISCORD_TOKEN) {
  logger.error("DISCORD_TOKEN is missing in .env");
  process.exit(1);
}

// Create the bot client
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.commands = new Collection();

// Load plugin/theme YAML data from GitHub first
loadPluginData()
  .then(() => {
    // Dynamically load all commands from subfolders
    const commandsPath = path.join(__dirname, "commands");

    if (fs.existsSync(commandsPath)) {
      const commandDirs = fs
        .readdirSync(commandsPath)
        .filter((dir) =>
          fs.statSync(path.join(commandsPath, dir)).isDirectory()
        );

      for (const dir of commandDirs) {
        const dirPath = path.join(commandsPath, dir);
        const commandFiles = fs
          .readdirSync(dirPath)
          .filter((file) => file.endsWith(".js"));

        for (const file of commandFiles) {
          const command = require(path.join(dirPath, file));
          if (command?.data && typeof command.execute === "function") {
            client.commands.set(command.data.name, command);
            logger.info(`Loaded command: ${command.data.name}`);
          } else {
            logger.warn(`Skipping invalid command in ${dir}/${file}`);
          }
        }
      }
    }

    // Dynamically load all events
    const eventsPath = path.join(__dirname, "events");
    if (fs.existsSync(eventsPath)) {
      const eventFiles = fs
        .readdirSync(eventsPath)
        .filter((file) => file.endsWith(".js"));

      for (const file of eventFiles) {
        const event = require(path.join(eventsPath, file));
        if (event?.name && typeof event.execute === "function") {
          if (event.once) {
            client.once(event.name, (...args) =>
              event.execute(...args, client)
            );
          } else {
            client.on(event.name, (...args) => event.execute(...args, client));
          }
          logger.info(`Registered event: ${event.name}`);
        } else {
          logger.warn(`Skipping invalid event: ${file}`);
        }
      }
    }

    // Start bot
    return client.login(process.env.DISCORD_TOKEN);
  })
  .then(() => {
    logger.success("Bot logged in successfully.");
  })
  .catch((err) => {
    logger.error(`Startup failed: ${err}`);
    process.exit(1);
  });
