require("dotenv").config();
const { Client, GatewayIntentBits, Collection, ActivityType } = require("discord.js");
const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
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

// Uptime start stamp
const startedAt = Date.now();

function formatUptime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  parts.push(`${hours}h`);
  parts.push(`${minutes}m`);

  return `Online for ${parts.join(" ")}`;
}

function getCounts() {
  try {
    const ymlPath = path.join(__dirname, "cache", "plugins-and-themes.yml");
    const raw = fs.readFileSync(ymlPath, "utf8");
    const data = yaml.load(raw) || {};

    return {
      plugins: Array.isArray(data.plugins) ? data.plugins.length : 0,
      themes: Array.isArray(data.themes) ? data.themes.length : 0,
    };
  } catch {
    return { plugins: 0, themes: 0 };
  }
}

// Load plugin/theme YAML data from GitHub first
loadPluginData()
  .then(() => {
    // Dynamically load all commands recursively
    const commandsPath = path.join(__dirname, "commands");
    if (fs.existsSync(commandsPath)) {
      function loadCommands(dir) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            loadCommands(fullPath);
          } else if (entry.isFile() && fullPath.endsWith(".js")) {
            const command = require(fullPath);
            if (command?.data && typeof command.execute === "function") {
              client.commands.set(command.data.name, command);
              logger.info(`Loaded command: ${command.data.name}`);
            } else {
              logger.warn(`Skipping invalid command: ${fullPath}`);
            }
          }
        }
      }
      loadCommands(commandsPath);
    }

    // Dynamically load all events
    const eventsPath = path.join(__dirname, "events");
    if (fs.existsSync(eventsPath)) {
      const eventFiles = fs.readdirSync(eventsPath).filter((file) => file.endsWith(".js"));

      for (const file of eventFiles) {
        const event = require(path.join(eventsPath, file));
        if (event?.name && typeof event.execute === "function") {
          if (event.once) {
            client.once(event.name, (...args) =>
              event.execute(...args, client),
            );
          } else {
            client.on(event.name, (...args) =>
              event.execute(...args, client),
            );
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

    const ROTATE_MS = 5 * 60 * 1000; // 5 minutes

    const updatePresence = () => {
      const uptime = formatUptime(Date.now() - startedAt);
      const { plugins, themes } = getCounts();

      const messages = [
        uptime,
        `${plugins} plugins in the registry`,
        `${themes} themes in the registry`,
        `${plugins} plugins • ${themes} themes`,
        `Try /search plugin`,
        `Try /search theme`,
        `Try /search creator`,
      ];

      const msg = messages[Math.floor(Math.random() * messages.length)];

      client.user.setPresence({
        status: "online",
        activities: [{ type: ActivityType.Playing, name: msg }],
      });
    };

    updatePresence();
    setInterval(updatePresence, ROTATE_MS);

    const REFRESH_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
    setInterval(() => {
      loadPluginData()
        .then(() => {
          logger.info("Periodic plugin/theme data refresh completed.");
        })
        .catch((err) => {
          logger.error(
            `Periodic plugin/theme data refresh failed: ${err.stack || err}`,
          );
        });
    }, REFRESH_INTERVAL_MS);
  })
  .catch((err) => {
    logger.error(`Startup failed: ${err.stack || err}`);
    process.exit(1);
  });
