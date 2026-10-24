const fetch = require("node-fetch");
const yaml = require("js-yaml");
const fs = require("node:fs");
const path = require("node:path");
const logger = require("./logger");

const REGISTRY_URL =
  "https://raw.githubusercontent.com/RusherDevelopment/rusherhack-plugins/main/data/plugins-and-themes.yml";

const CACHE_PATH = path.join(
  __dirname, "..", "cache", "plugins-and-themes.yml"
);

function createDataStore({
  fetchRegistry = fetch,
  cachePath = CACHE_PATH,
  registryUrl = REGISTRY_URL,
  log = logger,
} = {}) {
  let plugins = [];
  let themes = [];
  let lastLiveRefresh = null;
  let pendingRefresh = null;

  function parseRegistry(raw) {
    const parsed = yaml.load(raw);

    if (
      !parsed ||
      !Array.isArray(parsed.plugins) ||
      !Array.isArray(parsed.themes)
    ) {
      throw new Error("Invalid registry structure");
    }

    if (!parsed.plugins.length && !parsed.themes.length) {
      throw new Error("Registry contains no entries");
    }

    function normalize(items, kind) {
      return items.map((item, index) => {
        if (
          !item ||
          typeof item.name !== "string" ||
          !item.name.trim() ||
          typeof item.repo !== "string" ||
          !item.repo.trim()
        ) {
          throw new Error(
            `Invalid ${kind} entry at index ${index}`
          );
        }

        return {
          ...item,
          mc_versions: String(item.mc_versions ?? ""),
        };
      });
    }

    return {
      plugins: normalize(parsed.plugins, "plugin"),
      themes: normalize(parsed.themes, "theme"),
    };
  }

  function saveCache(raw) {
    fs.mkdirSync(path.dirname(cachePath), {
      recursive: true,
    });

    const temporary = `${cachePath}.${process.pid}.${Date.now()}.tmp`;

    try {
      fs.writeFileSync(temporary, raw, { flag: "wx" });
      fs.renameSync(temporary, cachePath);
    } finally {
      if (fs.existsSync(temporary)) {
        fs.unlinkSync(temporary);
      }
    }
  }

  async function performRefresh() {
    try {
      const controller = new AbortController();
      const timer = setTimeout(
        () => controller.abort(),
        8000
      );

      let raw;

      try {
        const response = await fetchRegistry(registryUrl, {
          signal: controller.signal,
          size: 2 * 1024 * 1024,
        });

        if (!response.ok) {
          throw new Error(`GitHub HTTP ${response.status}`);
        }

        raw = await response.text();
      } finally {
        clearTimeout(timer);
      }

      const next = parseRegistry(raw);
      let cacheUpdated = true;

      try {
        saveCache(raw);
      } catch (error) {
        cacheUpdated = false;
        log.warn(`Registry cache write failed: ${error.message}`);
      }

      plugins = next.plugins;
      themes = next.themes;
      lastLiveRefresh = new Date().toISOString();

      log.success(
        `Registry loaded: ${plugins.length} plugins, ` +
        `${themes.length} themes`
      );

      return {
        source: "github",
        plugins: plugins.length,
        themes: themes.length,
        cacheUpdated,
        lastLiveRefresh,
      };
    } catch (error) {
      log.warn(`GitHub registry refresh failed: ${error.message}`);

      // Never replace valid in-memory data with stale or empty data.
      if (plugins.length || themes.length) {
        log.warn("Preserving last-known-good in-memory registry");

        return {
          source: "memory",
          plugins: plugins.length,
          themes: themes.length,
          lastLiveRefresh,
        };
      }

      // Cold startup: attempt the validated disk cache.
      try {
        const raw = fs.readFileSync(cachePath, "utf8");
        const next = parseRegistry(raw);

        plugins = next.plugins;
        themes = next.themes;

        log.warn(
          `Using cached registry: ${plugins.length} plugins, ` +
          `${themes.length} themes`
        );

        return {
          source: "cache",
          plugins: plugins.length,
          themes: themes.length,
          lastLiveRefresh,
        };
      } catch (cacheError) {
        throw new Error(
          `Registry unavailable: GitHub (${error.message}); ` +
          `cache (${cacheError.message})`
        );
      }
    }
  }

  function loadPluginData() {
    if (!pendingRefresh) {
      pendingRefresh = performRefresh().finally(() => {
        pendingRefresh = null;
      });
    }

    return pendingRefresh;
  }

  return {
    loadPluginData,
    getPlugins: () => plugins,
    getThemes: () => themes,
    getPluginByName: (name) =>
      plugins.find(
        (p) => p.name.toLowerCase() === String(name).toLowerCase()
      ),
    getThemeByName: (name) =>
      themes.find(
        (t) => t.name.toLowerCase() === String(name).toLowerCase()
      ),
  };
}

module.exports = {
  ...createDataStore(),
  createDataStore,
};
