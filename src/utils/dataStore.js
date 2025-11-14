// src/utils/dataStore.js
const fetch = require("node-fetch");
const yaml = require("js-yaml");
const fs = require("fs");
const path = require("path");
const logger = require("./logger");

const RAW_YML_URL =
  "https://raw.githubusercontent.com/RusherDevelopment/rusherhack-plugins/main/data/plugins-and-themes.yml";
const BACKUP_PATH = path.join(__dirname, "..", "cache", "plugins-and-themes.yml");

let plugins = [];
let themes = [];

/**
 * Ensure mc_versions is always a string so downstream code
 * (search, version filtering) can safely call .split(",").
 */
function normalizeMcVersions(list, kind) {
  for (const item of list) {
    if (typeof item.mc_versions !== "string") {
      logger.warn(
        `Invalid mc_versions for ${kind} ${item.name}: ${JSON.stringify(
          item.mc_versions,
        )} (coercing to string)`,
      );
      item.mc_versions = String(item.mc_versions || "");
    }
  }
}

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

    normalizeMcVersions(plugins, "plugin");
    normalizeMcVersions(themes, "theme");

    fs.mkdirSync(path.dirname(BACKUP_PATH), { recursive: true });
    fs.writeFileSync(BACKUP_PATH, text, "utf8");

    logger.success(`Loaded ${plugins.length} plugins and ${themes.length} themes`);
  } catch (err) {
    logger.error("Failed to fetch or parse plugin YAML from GitHub:");
    logger.error(err.stack || String(err));

    // Fallback to disk
    try {
      const cached = fs.readFileSync(BACKUP_PATH, "utf8");
      const parsed = yaml.load(cached);

      plugins = parsed.plugins || [];
      themes = parsed.themes || [];

      normalizeMcVersions(plugins, "plugin");
      normalizeMcVersions(themes, "theme");

      logger.warn(
        `Used cached YAML data from disk (${plugins.length} plugins, ${themes.length} themes)`,
      );
    } catch (fallbackError) {
      logger.error("Failed to load cached YAML from disk as fallback");
      logger.error(fallbackError.stack || String(fallbackError));

      // Leave plugins/themes as empty arrays if both live + fallback fail
      plugins = [];
      themes = [];
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
  return plugins.find(
    (p) => p.name && p.name.toLowerCase() === name.toLowerCase(),
  );
}

function getThemeByName(name) {
  return themes.find(
    (t) => t.name && t.name.toLowerCase() === name.toLowerCase(),
  );
}

module.exports = {
  loadPluginData,
  getPlugins,
  getThemes,
  getPluginByName,
  getThemeByName,
};
