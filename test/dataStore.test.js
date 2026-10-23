const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { createDataStore } = require("../src/utils/dataStore");

const VALID = `plugins:
  - name: Test Plugin
    repo: Example/TestPlugin
    mc_versions: 1.21
themes:
  - name: Test Theme
    repo: Example/TestTheme
    mc_versions: '1.21.11'
`;

const INVALID = "plugins: [broken";
const EMPTY = "plugins: []\nthemes: []\n";

const log = {
  warn() {},
  success() {},
};

const response = (body) => ({
  ok: true,
  text: async () => body,
});

const offline = async () => {
  throw new Error("Simulated network outage");
};

function fixture(t) {
  const dir = fs.mkdtempSync(
    path.join(os.tmpdir(), "rusher-registry-")
  );

  t.after(() => fs.rmSync(dir, {
    recursive: true,
    force: true,
  }));

  return path.join(dir, "registry.yml");
}

test("loads valid GitHub registry and saves cache", async (t) => {
  const cachePath = fixture(t);

  const store = createDataStore({
    fetchRegistry: async () => response(VALID),
    cachePath,
    log,
  });

  const result = await store.loadPluginData();

  assert.equal(result.source, "github");
  assert.equal(result.plugins, 1);
  assert.equal(result.themes, 1);
  assert.equal(result.cacheUpdated, true);
  assert.equal(
    store.getPluginByName("Test Plugin").mc_versions,
    "1.21"
  );
  assert.equal(fs.readFileSync(cachePath, "utf8"), VALID);
});

test("preserves memory when GitHub goes offline", async (t) => {
  const cachePath = fixture(t);
  let online = true;

  const store = createDataStore({
    fetchRegistry: async () => {
      if (!online) return offline();
      return response(VALID);
    },
    cachePath,
    log,
  });

  await store.loadPluginData();
  online = false;

  const result = await store.loadPluginData();

  assert.equal(result.source, "memory");
  assert.equal(store.getPlugins().length, 1);
  assert.equal(store.getThemes().length, 1);
});

test("rejects malformed downloads without corrupting cache", async (t) => {
  const cachePath = fixture(t);
  let body = VALID;

  const store = createDataStore({
    fetchRegistry: async () => response(body),
    cachePath,
    log,
  });

  await store.loadPluginData();
  body = INVALID;

  const result = await store.loadPluginData();

  assert.equal(result.source, "memory");
  assert.equal(fs.readFileSync(cachePath, "utf8"), VALID);
});

test("rejects unexpectedly empty registry", async (t) => {
  const cachePath = fixture(t);
  let body = VALID;

  const store = createDataStore({
    fetchRegistry: async () => response(body),
    cachePath,
    log,
  });

  await store.loadPluginData();
  body = EMPTY;

  const result = await store.loadPluginData();

  assert.equal(result.source, "memory");
  assert.equal(store.getPlugins().length, 1);
  assert.equal(fs.readFileSync(cachePath, "utf8"), VALID);
});

test("recovers from cache during offline startup", async (t) => {
  const cachePath = fixture(t);
  fs.writeFileSync(cachePath, VALID);

  const store = createDataStore({
    fetchRegistry: offline,
    cachePath,
    log,
  });

  const result = await store.loadPluginData();

  assert.equal(result.source, "cache");
  assert.equal(result.plugins, 1);
  assert.equal(result.themes, 1);
});

test("fails startup if both GitHub and cache are unusable", async (t) => {
  const cachePath = fixture(t);
  fs.writeFileSync(cachePath, INVALID);

  const store = createDataStore({
    fetchRegistry: offline,
    cachePath,
    log,
  });

  await assert.rejects(
    store.loadPluginData(),
    /Registry unavailable/
  );
});

test("combines simultaneous refresh requests", async (t) => {
  const cachePath = fixture(t);
  let requests = 0;

  const store = createDataStore({
    fetchRegistry: async () => {
      requests++;
      await new Promise((resolve) => setImmediate(resolve));
      return response(VALID);
    },
    cachePath,
    log,
  });

  const results = await Promise.all([
    store.loadPluginData(),
    store.loadPluginData(),
    store.loadPluginData(),
  ]);

  assert.equal(requests, 1);
  assert.ok(results.every((r) => r.source === "github"));
});
