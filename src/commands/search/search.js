const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const {
  getPlugins, getThemes, getPluginByName, getThemeByName,
} = require("../../utils/dataStore");
const { createPluginEmbed } = require("../../utils/embedBuilder");
const { getRepoDetails } = require("../../utils/getRepoDetails");

// version helpers
function versionCompare(v1, v2) {
  if (!v1 || !v2) return 0;
  const a = v1.split(".").map((n) => parseInt(n, 10) || 0);
  const b = v2.split(".").map((n) => parseInt(n, 10) || 0);
  const m = Math.max(a.length, b.length);
  for (let i = 0; i < m; i++) {
    const x = a[i] || 0; const y = b[i] || 0;
    if (x > y) return 1;
    if (x < y) return -1;
  }
  return 0;
}
function isVersionSupported(item, query) {
  if (!query) return true;
  if (!item || !item.mc_versions) return false;
  const ranges = item.mc_versions.split(",").map(function (r) { return r.trim(); });
  for (let i = 0; i < ranges.length; i++) {
    const range = ranges[i];
    if (!range) continue;
    if (range.indexOf("-") !== -1) {
      const parts = range.split("-");
      const start = (parts[0] || "").trim();
      const end = (parts[1] || "").trim();
      if (versionCompare(query, start) >= 0 && versionCompare(query, end) <= 0) return true;
    } else if (versionCompare(query, range) === 0) return true;
  }
  return false;
}

// small utils
function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
function toBlocks(items, fmtFn) { return items.map(fmtFn).join("\n\n"); }
function truncate(s, n) { return (s && s.length > n ? s.slice(0, n - 1) + "…" : (s || "—")); }

// search helpers
function normalize(s) { return String(s || "").toLowerCase(); }
function matchQuery(item, q) {
  if (!q) return true;
  const n = normalize(q);
  const creatorName = item && item.creator ? item.creator.name : "";
  const hay = [
    item ? item.name : "",
    item ? item.description : "",
    creatorName,
    item ? item.repo : "",
    item ? item.mc_versions : ""
  ].filter(Boolean).join(" ").toLowerCase();
  return hay.indexOf(n) !== -1;
}
function filterAndSort(pool, q, mc) {
  return pool()
    .filter(function (it) { return matchQuery(it, q) && isVersionSupported(it, mc); })
    .sort(function (a, b) { return (a.name || "").localeCompare(b.name || ""); });
}
function paginate(arr, page, perPage) {
  const total = arr.length;
  const pageCount = Math.max(1, Math.ceil(total / perPage));
  const p = clamp(page, 1, pageCount);
  const start = (p - 1) * perPage;
  return { slice: arr.slice(start, start + perPage), p: p, pageCount: pageCount, total: total };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("search")
    .setDescription("Search Rusher plugins/themes (public, single-message results)")
    .addSubcommand(function (sub) {
      return sub.setName("plugin")
        .setDescription("Show details about a plugin")
        .addStringOption(function (o) {
          return o.setName("name").setDescription("Exact plugin name").setRequired(true).setAutocomplete(true);
        })
        .addStringOption(function (o) {
          return o.setName("mc_version").setDescription("Filter by MC version (e.g., 1.21.4)").setRequired(false);
        });
    })
    .addSubcommand(function (sub) {
      return sub.setName("theme")
        .setDescription("Show details about a theme")
        .addStringOption(function (o) {
          return o.setName("name").setDescription("Exact theme name").setRequired(true).setAutocomplete(true);
        })
        .addStringOption(function (o) {
          return o.setName("mc_version").setDescription("Filter by MC version (e.g., 1.21.4)").setRequired(false);
        });
    })
    .addSubcommand(function (sub) {
      return sub.setName("creator")
        .setDescription("List plugins & themes by creator (paged)")
        .addStringOption(function (o) {
          return o.setName("name").setDescription("Creator name").setRequired(true).setAutocomplete(true);
        })
        .addIntegerOption(function (o) {
          return o.setName("page").setDescription("Page number (default 1)").setMinValue(1).setRequired(false);
        })
        .addIntegerOption(function (o) {
          return o.setName("per_page").setDescription("Items per page (default 5, max 10)").setMinValue(1).setMaxValue(10).setRequired(false);
        })
        .addStringOption(function (o) {
          return o.setName("mc_version").setDescription("Filter by MC version (e.g., 1.21.4)").setRequired(false);
        });
    }),

  async autocomplete(interaction) {
    try {
      const sub = interaction.options.getSubcommand();
      const focus = interaction.options.getFocused(true);
      const val = String(focus && focus.value ? focus.value : "").toLowerCase();

      if (sub === "plugin") {
        const names = getPlugins()().map(function (p) { return p.name; }).filter(Boolean);
        return interaction.respond(
          names.filter(function (n) { return n.toLowerCase().includes(val); }).slice(0, 25).map(function (c) { return { name: c, value: c }; })
        );
      }
      if (sub === "theme") {
        const names = getThemes()().map(function (t) { return t.name; }).filter(Boolean);
        return interaction.respond(
          names.filter(function (n) { return n.toLowerCase().includes(val); }).slice(0, 25).map(function (c) { return { name: c, value: c }; })
        );
      }
      if (sub === "creator") {
        const creators = new Set();
        getPlugins()().forEach(function (p) { if (p && p.creator && p.creator.name) creators.add(p.creator.name); });
        getThemes()().forEach(function (t) { if (t && t.creator && t.creator.name) creators.add(t.creator.name); });
        const list = Array.from(creators).filter(function (n) { return n.toLowerCase().includes(val); }).slice(0, 25);
        return interaction.respond(list.map(function (c) { return { name: c, value: c }; }));
      }
    } catch (e) { /* ignore */ }
  },

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === "plugin") {
      const name = interaction.options.getString("name", true);
      const mc = interaction.options.getString("mc_version") || "";
      const item = getPluginByName(name);
      if (!item) return interaction.reply({ content: "❌ Plugin **" + name + "** not found.", allowedMentions: { parse: [] } });
      if (!isVersionSupported(item, mc)) {
        return interaction.reply({ content: "❌ **" + name + "** does not list support for MC `" + mc + "`.", allowedMentions: { parse: [] } });
      }

      const stats = item.repo ? await getRepoDetails(item.repo) : null;

      let embed = null;
      try {
        if (createPluginEmbed) embed = await createPluginEmbed(item, stats, true, interaction.client);
      } catch (e) { /* fallback below */ }
      if (!embed) {
        embed = new EmbedBuilder()
          .setTitle(item.name || "Untitled")
          .setURL(item.repo ? "https://github.com/" + item.repo : null)
          .setDescription(truncate(item.description, 400));
        if (stats) {
          const parts = [];
          if (typeof stats.stars === "number") parts.push("**Stars:** " + stats.stars);
          if (typeof stats.downloadCount === "number") parts.push("**Downloads:** " + stats.downloadCount);
          if (stats.lastCommit) {
            const d = new Date(stats.lastCommit).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
            parts.push("**Last Commit:** " + d);
          }
          if (parts.length) embed.addFields({ name: "GitHub", value: parts.join("\n"), inline: true });
        }
        if (item.mc_versions || item.latest_release_tag) {
          const lines = [];
          if (item.mc_versions) lines.push("**MC Versions:** " + item.mc_versions);
          if (item.latest_release_tag) lines.push("**Latest Release:** `" + item.latest_release_tag + "`");
          if (lines.length) embed.addFields({ name: "Plugin Info", value: lines.join("\n"), inline: true });
        }
      }
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === "theme") {
      const name = interaction.options.getString("name", true);
      const mc = interaction.options.getString("mc_version") || "";
      const item = getThemeByName(name);
      if (!item) return interaction.reply({ content: "❌ Theme **" + name + "** not found.", allowedMentions: { parse: [] } });
      if (!isVersionSupported(item, mc)) {
        return interaction.reply({ content: "❌ **" + name + "** does not list support for MC `" + mc + "`.", allowedMentions: { parse: [] } });
      }

      const stats = item.repo ? await getRepoDetails(item.repo) : null;

      const e = new EmbedBuilder()
        .setTitle(item.name || "Untitled")
        .setURL(item.repo ? "https://github.com/" + item.repo : null)
        .setDescription(truncate(item.description, 400));
      if (item && item.creator && item.creator.name) {
        e.setAuthor({ name: item.creator.name, url: item.creator.url || null, iconURL: item.creator.avatar || null });
      }
      if (item.latest_release_tag) e.addFields({ name: "Latest", value: String(item.latest_release_tag), inline: true });
      if (item.mc_versions) e.addFields({ name: "MC", value: item.mc_versions, inline: true });
      if (stats) {
        const parts = [];
        if (typeof stats.stars === "number") parts.push("**Stars:** " + stats.stars);
        if (typeof stats.downloadCount === "number") parts.push("**Downloads:** " + stats.downloadCount);
        if (stats.lastCommit) {
          const d = new Date(stats.lastCommit).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
          parts.push("**Last Commit:** " + d);
        }
        if (parts.length) e.addFields({ name: "GitHub", value: parts.join("\n"), inline: true });
      }
      return interaction.reply({ embeds: [e] });
    }

    if (sub === "creator") {
      const creator = interaction.options.getString("name", true);
      const page = interaction.options.getInteger("page") || 1;
      const perPage = interaction.options.getInteger("per_page") || 5;
      const mc = interaction.options.getString("mc_version") || "";

      function byCreator(it) {
        const c = it && it.creator ? it.creator.name : "";
        return c.toLowerCase() === creator.toLowerCase();
      }

      const items = []
        .concat(filterAndSort(getPlugins, creator, mc).filter(byCreator))
        .concat(filterAndSort(getThemes, creator, mc).filter(byCreator));

      if (!items.length) {
        return interaction.reply({
          content: "No items found for creator **" + creator + "**" + (mc ? " (MC `" + mc + "`)" : "") + ".",
          allowedMentions: { parse: [] },
        });
      }

      const pg = paginate(items, page, perPage);
      const blocks = toBlocks(pg.slice, function (it) {
        const repoUrl = it && it.repo ? "https://github.com/" + it.repo : "#";
        const title = "**[" + (it.name || "Untitled") + "](" + repoUrl + ")** — " + (it.is_core ? "Core" : "Plugin");
        const desc = truncate(it.description, 180);
        const lines = [title, desc];
        if (it.latest_release_tag) lines.push("Latest: `" + it.latest_release_tag + "`");
        if (it.mc_versions) lines.push("MC: `" + it.mc_versions + "`");
        return lines.join("\n");
      });

      const e = new EmbedBuilder()
        .setTitle("Items by Creator: " + creator)
        .setDescription(blocks)
        .setFooter({ text: "Page " + pg.p + "/" + pg.pageCount + " • " + pg.total + " total" + (mc ? " • MC " + mc : "") });

      return interaction.reply({
        content: "[View GitHub Profile](https://github.com/" + encodeURIComponent(creator) + ")",
        embeds: [e],
        allowedMentions: { parse: [] },
      });
    }
  },
};
