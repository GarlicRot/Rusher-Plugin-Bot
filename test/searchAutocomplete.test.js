const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const yaml = require("js-yaml");

const registry = yaml.load(
  fs.readFileSync(
    path.join(__dirname, "../src/cache/plugins-and-themes.yml"),
    "utf8"
  )
);

const plugins = registry.plugins || [];
const themes = registry.themes || [];
const items = [...plugins, ...themes];

const store = require("../src/utils/dataStore");
store.getPlugins = () => plugins;
store.getThemes = () => themes;

const search = require("../src/commands/search/search");

async function getChoices(subcommand, creator = "", focused = "") {
  let choices;

  await search.autocomplete({
    options: {
      getSubcommand: () => subcommand,
      getFocused: () => ({
        name: "mc_version",
        value: focused
      }),
      get: name =>
        name === "name" ? { value: creator } : null,
      getString: name =>
        name === "name" ? creator : null
    },
    respond: async results => {
      choices = results;
    }
  });

  assert.ok(Array.isArray(choices));
  return choices.map(choice => choice.value);
}

function expectedVersions(entries) {
  return [...new Set(
    entries.flatMap(item =>
      String(item.mc_versions || "")
        .split(",")
        .map(version => version.trim())
        .filter(version =>
          /^\d+\.\d+(?:\.\d+)?$/.test(version)
        )
    )
  )].sort((a, b) =>
    b.localeCompare(a, undefined, { numeric: true })
  );
}

test("creator versions match YAML registry", async () => {
  const creator = "GarlicRot";

  const matching = items.filter(item =>
    item.creator?.name?.toLowerCase() === creator.toLowerCase()
  );

  assert.ok(matching.length > 0);

  const actual = await getChoices("creator", creator);
  assert.deepEqual(actual, expectedVersions(matching).slice(0, 25));
});

test("different creators receive their own versions", async () => {
  const creator = "h1tm4nqq";

  const matching = items.filter(item =>
    item.creator?.name?.toLowerCase() === creator.toLowerCase()
  );

  assert.ok(matching.length > 0);

  const actual = await getChoices("creator", creator);
  assert.deepEqual(actual, expectedVersions(matching).slice(0, 25));
});

test("unknown creator receives no versions", async () => {
  const actual = await getChoices(
    "creator",
    "CreatorThatDoesNotExist123"
  );

  assert.deepEqual(actual, []);
});

test("global version search includes all registry versions", async () => {
  const actual = await getChoices("version");

  assert.deepEqual(
    actual,
    expectedVersions(items).slice(0, 25)
  );
});
