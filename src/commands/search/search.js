// src/commands/search/search.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const {
  getPlugins,
  getThemes,
  getPluginByName,
  getThemeByName,
} = require("../../utils/dataStore");
const { createPluginEmbed } = require("../../utils/embedBuilder");
const { getRepoDetails } = require("../../utils/getRepoDetails");

/* ---------- version helpers ---------- */
function versionCompare(v1, v2) {
  if (!v1 || !v2) return 0;
  const a = v1.split(".").map((n) => parseInt(n, 10) || 0);
  const b = v2.split(".").map((n) => parseInt(n, 10) || 0);
  const m = Math.max(a.length, b.length);
  for (let i = 0; i < m; i++) {
    const x = a[i] || 0, y = b[i] || 0;
    if (x > y) return 1;
    if (x < y) return -1;
  }
  return 0;
}
function isVersionSupported(item, query) {
  if (!query) return true;
  if (!item?.mc_versions) return false;
  const ranges = item.mc_versions.split(",").map((r) => r.trim());
  for (const range of ranges) {
    if (!range) continue;
    if (range.includes("-")) {
      const [start, end] = range.split("-").map((v) => v.trim());
      if (versionCompare(query, start) >= 0 && versionCompare(query, end) <= 0) return true;
    } else if (versionCompare(query, range) === 0) return true;
  }
  return false;
}

/* ---------- small utils ---------- */
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const truncate = (s, n) => (s && s.length > n ? s.slice(0, n - 1) + "…" : s || "—");
const toBlocks = (items, fmt) => items.map(fmt).join("\n\n");

/* ---------- search helpers ---------- */
function matchQuery(item, q) {
  if (!q) return true;
  const needle = String(q || "").toLowerCase();
  const hay = [
    item?.name,
    item?.description,
    item?.creator?.name,
    item?.repo,
    item?.mc_versions,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(needle);
}
function filterAndSort(getter, q, mc) {
  return getter()
    .filter((it) => matchQuery(it, q) && isVersionSupported(it, mc))
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
}
function paginate(arr, page, perPage) {
  const total = arr.length;
  const pageCount = Math.max(1, Math.ceil(total / perPage));
  const p = clamp(page || 1, 1, pageCount);
  const start = (p - 1) * perPage;
  return { slice: arr.slice(start, start + perPage), p, pageCount, total };
}

/* ---------- command ---------- */
module.exports = {
  data: new SlashCommandBuilder()
    .setName("search")
    .setDescription("Search Rusher plugins/themes")
    .addSubcommand((sub) =>
      sub.setName("plugin")
        .setDescription("Show details about a plugin")
        .addStringOption((o) =>
          o.setName("name").setDescription("Exact plugin name").setRequired(true).setAutocomplete(true)
        )
        .addStringOption((o) =>
          o.setName("mc_version").setDescription("Filter by MC version (e.g., 1.21.4)")
        )
    )
    .addSubcommand((sub) =>
      sub.setName("theme")
        .setDescription("Show details about a theme")
        .addStringOption((o) =>
          o.setName("name").setDescription("Exact theme name").setRequired(true).setAutocomplete(true)
        )
        .addStringOption((o) =>
          o.setName("mc_version").setDescription("Filter by MC version (e.g., 1.21.4)")
        )
    )
    .addSubcommand((sub) =>
      sub.setName("creator")
        .setDescription("List plugins & themes by creator (paged)")
        .addStringOption((o) =>
          o.setName("name").setDescription("Creator name").setRequired(true).setAutocomplete(true)
        )
        .addIntegerOption((o) =>
          o.setName("page").setDescription("Page number (default 1)").setMinValue(1)
        )
        .addIntegerOption((o) =>
          o.setName("per_page").setDescription("Items per page (default 5, max 10)").setMinValue(1).setMaxValue(10)
        )
        .addStringOption((o) =>
          o.setName("mc_version").setDescription("Filter by MC version (e.g., 1.21.4)")
        )
    ),

  /* ---------- autocomplete ---------- */
  async autocomplete(interaction) {
    try {
      const sub = interaction.options.getSubcommand();
      const focused = (interaction.options.getFocused(true)?.value || "").toLowerCase();

      if (sub === "plugin") {
        const names = getPlugins().map((p) => p.name).filter(Boolean);
        return interaction.respond(
          names.filter((n) => n.toLowerCase().includes(focused)).slice(0, 25).map((n) => ({ name: n, value: n }))
        );
      }
      if (sub === "theme") {
        const names = getThemes().map((t) => t.name).filter(Boolean);
        return interaction.respond(
          names.filter((n) => n.toLowerCase().includes(focused)).slice(0, 25).map((n) => ({ name: n, value: n }))
        );
      }
      if (sub === "creator") {
        const creators = new Set();
        for (const p of getPlugins()) if (p?.creator?.name) creators.add(p.creator.name);
        for (const t of getThemes()) if (t?.creator?.name) creators.add(t.creator.name);
        const list = [...creators].filter((n) => n.toLowerCase().includes(focused)).slice(0, 25);
        return interaction.respond(list.map((n) => ({ name: n, value: n })));
      }
    } catch {
      /* ignore autocomplete errors */
    }
  },

  /* ---------- execute ---------- */
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === "plugin") {
      const name = interaction.options.getString("name", true);
      const mc = interaction.options.getString("mc_version") || "";
      const item = getPluginByName(name);

      if (!item) {
        return interaction.reply({ content: `❌ Plugin **${name}** not found.`, allowedMentions: { parse: [] } });
      }
      if (!isVersionSupported(item, mc)) {
        return interaction.reply({ content: `❌ **${name}** does not list support for MC \`${mc}\`.`, allowedMentions: { parse: [] } });
      }

      const stats = item.repo ? await getRepoDetails(item.repo) : null;

      let embed = createPluginEmbed ? await createPluginEmbed(item, stats, true, interaction.client) : null;
      if (!embed) {
        embed = new EmbedBuilder()
          .setTitle(item.name || "Untitled")
          .setURL(item.repo ? `https://github.com/${item.repo}` : null)
          .setDescription(truncate(item.description, 400));
        if (item.mc_versions || item.latest_release_tag) {
          const lines = [];
          if (item.mc_versions) lines.push(`**MC Versions:** ${item.mc_versions}`);
          if (item.latest_release_tag) lines.push(`**Latest Release:** \`${item.latest_release_tag}\``);
          if (lines.length) embed.addFields({ name: "Plugin Info", value: lines.join("\n"), inline: true });
        }
        if (stats) {
          const parts = [];
          if (typeof stats.stars === "number") parts.push(`**Stars:** ${stats.stars}`);
          if (typeof stats.downloadCount === "number") parts.push(`**Downloads:** ${stats.downloadCount}`);
          if (stats.lastCommit) {
            const d = new Date(stats.lastCommit).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
            parts.push(`**Last Commit:** ${d}`);
          }
          if (parts.length) embed.addFields({ name: "GitHub", value: parts.join("\n"), inline: true });
        }
      }
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === "theme") {
      const name = interaction.options.getString("name", true);
      const mc = interaction.options.getString("mc_version") || "";
      const item = getThemeByName(name);

      if (!item) {
        return interaction.reply({ content: `❌ Theme **${name}** not found.`, allowedMentions: { parse: [] } });
      }
      if (!isVersionSupported(item, mc)) {
        return interaction.reply({ content: `❌ **${name}** does not list support for MC \`${mc}\`.`, allowedMentions: { parse: [] } });
      }

      const stats = item.repo ? await getRepoDetails(item.repo) : null;

      const e = new EmbedBuilder()
        .setTitle(item.name || "Untitled")
        .setURL(item.repo ? `https://github.com/${item.repo}` : null)
        .setDescription(truncate(item.description, 400));

      if (item.creator?.name) e.setAuthor({ name: item.creator.name, url: item.creator.url || null, iconURL: item.creator.avatar || null });
      if (item.latest_release_tag) e.addFields({ name: "Latest", value: `${item.latest_release_tag}`, inline: true });
      if (item.mc_versions) e.addFields({ name: "MC", value: item.mc_versions, inline: true });

      if (stats) {
        const parts = [];
        if (typeof stats.stars === "number") parts.push(`**Stars:** ${stats.stars}`);
        if (typeof stats.downloadCount === "number") parts.push(`**Downloads:** ${stats.downloadCount}`);
        if (stats.lastCommit) {
          const d = new Date(stats.lastCommit).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
          parts.push(`**Last Commit:** ${d}`);
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

      const byCreator = (it) => (it?.creator?.name || "").toLowerCase() === creator.toLowerCase();
      const items = [
        ...filterAndSort(getPlugins, creator, mc).filter(byCreator),
        ...filterAndSort(getThemes, creator, mc).filter(byCreator),
      ];

      if (!items.length) {
        return interaction.reply({
          content: `No items found for creator **${creator}**${mc ? ` (MC \`${mc}\`)` : ""}.`,
          allowedMentions: { parse: [] },
        });
      }

      const { slice, p, pageCount, total } = paginate(items, page, perPage);
      const blocks = toBlocks(slice, (it) => {
        const title = `**[${it.name}](${it.repo ? `https://github.com/${it.repo}` : "#"})** — ${it.is_core ? "Core" : "Plugin"}`;
        const desc = truncate(it.description, 180);
        return [title, desc, it.latest_release_tag ? `Latest: \`${it.latest_release_tag}\`` : null, it.mc_versions ? `MC: \`${it.mc_versions}\`` : null]
          .filter(Boolean).join("\n");
      });

      const e = new EmbedBuilder()
        .setTitle(`Items by Creator: ${creator}`)
        .setDescription(blocks)
        .setFooter({ text: `Page ${p}/${pageCount} • ${total} total${mc ? ` • MC ${mc}` : ""}` });

      return interaction.reply({
        content: `[View GitHub Profile](https://github.com/${encodeURIComponent(creator)})`,
        embeds: [e],
        allowedMentions: { parse: [] },
      });
    }
  },
};
