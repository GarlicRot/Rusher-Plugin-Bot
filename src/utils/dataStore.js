const fetch = require("node-fetch");
const yaml = require("js-yaml");
const fs = require("fs");
const path = require("path");
const logger = require("./logger");

const RAW_YML_URL =
  "https://raw.githubusercontent.com/RusherDevelopment/rusherhack-plugins/main/data/plugins-and-themes.yml";
const BACKUP_PATH = path.join(
  __dirname,
  "..",
  "cache",
  "plugins-and-themes.yml"
);

let plugins = [];
let themes = [];

/**
 * Fetches the YAML and saves it locally.
 */
async function loadPluginData() {
  try {
    const res = await fetch(RAW_YML_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);

    const text = await res.text();
    const parsed = yaml.load(text);

    plugins = parsed.plugins || [];
    themes = parsed.themes || [];

    fs.mkdirSync(path.dirname(BACKUP_PATH), { recursive: true });
    fs.writeFileSync(BACKUP_PATH, text);
    logger.success(
      `Loaded ${plugins.length} plugins and ${themes.length} themes`
    );
    logger.info(`Saved YAML backup to ${BACKUP_PATH}`);
  } catch (err) {
    logger.error("Failed to fetch or parse plugin YAML from GitHub:");
    console.error(err);

    // fallback to disk
    try {
      const cached = fs.readFileSync(BACKUP_PATH, "utf8");
      const parsed = yaml.load(cached);
      plugins = parsed.plugins || [];
      themes = parsed.themes || [];
      logger.warn("Used cached YAML data from disk");
    } catch (fallbackError) {
      logger.error("Failed to load cached YAML from disk as fallback");
      console.error(fallbackError);
    }
  }
}

function getPlugins() {
  return plugins;
}

function getThemes() {
  return themes;
}

function getPluginByName(name) {
  return plugins.find((p) => p.name.toLowerCase() === name.toLowerCase());
}

function getThemeByName(name) {
  return themes.find((t) => t.name.toLowerCase() === name.toLowerCase());
}

module.exports = {
  loadPluginData,
  getPlugins,
  getThemes,
  getPluginByName,
  getThemeByName,
};
