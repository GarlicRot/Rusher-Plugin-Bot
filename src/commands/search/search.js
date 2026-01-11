const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const {
  getPlugins,
  getThemes,
  getPluginByName,
  getThemeByName,
} = require("../../utils/dataStore");
const { createPluginEmbed } = require("../../utils/embedBuilder");
const { getRepoDetails } = require("../../utils/getRepoDetails");

const PER_PAGE = 5;

/* version helpers */
function versionCompare(v1, v2) {
  if (!v1 || !v2) return 0;
  const a = v1.split(".").map((n) => parseInt(n, 10) || 0);
  const b = v2.split(".").map((n) => parseInt(n, 10) || 0);
  const m = Math.max(a.length, b.length);
  for (let i = 0; i < m; i++) {
    const x = a[i] || 0;
    const y = b[i] || 0;
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
      if (
        versionCompare(query, start) >= 0 &&
        versionCompare(query, end) <= 0
      ) {
        return true;
      }
    } else if (versionCompare(query, range) === 0) {
      return true;
    }
  }
  return false;
}

/* small utils */
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const truncate = (s, n) =>
  s && s.length > n ? s.slice(0, n - 1) + "…" : s || "—";
const toBlocks = (items, fmt) => items.map(fmt).join("\n\n");

/* search helpers */
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
  return {
    slice: arr.slice(start, start + perPage),
    p,
    pageCount,
    total,
  };
}

function labelForItem(it) {
  if (it.type === "theme") return "Theme";
  if (it.is_core) return "Core";
  return "Plugin";
}

/**
 * Best-effort URL for “Latest”:
 * - prefer jar_url from YAML
 * - then download_url / latest_download_url
 * - then GitHub release tag page
 */
function getLatestUrl(it) {
  const direct =
    it.jar_url ||
    it.download_url ||
    it.latest_download_url ||
    (it.download && it.download.url);
  if (direct) return direct;

  if (it.repo && it.latest_release_tag) {
    return `https://github.com/${it.repo}/releases/tag/${encodeURIComponent(
      it.latest_release_tag,
    )}`;
  }

  return null;
}

/* shared list helpers for creator + version */

/**
 * Return fully enriched items (including any extra fields)
 * for a given creator + optional MC filter.
 */
function getItemsByCreator(creator, mc) {
  const lcCreator = (creator || "").toLowerCase();
  const byCreator = (it) =>
    (it?.creator?.name || "").toLowerCase() === lcCreator;

  const pluginItems = filterAndSort(getPlugins, creator, mc)
    .filter(byCreator)
    .map((it) => getPluginByName(it.name) || it);

  const themeItems = filterAndSort(getThemes, creator, mc)
    .filter(byCreator)
    .map((it) => getThemeByName(it.name) || it);

  return [...pluginItems, ...themeItems];
}

/**
 * Return fully enriched items for a given MC version.
 */
function getItemsByVersion(mc) {
  const pluginItems = filterAndSort(getPlugins, "", mc).map(
    (it) => getPluginByName(it.name) || it,
  );
  const themeItems = filterAndSort(getThemes, "", mc).map(
    (it) => getThemeByName(it.name) || it,
  );

  return [...pluginItems, ...themeItems];
}

function buildCreatorPagePayload(creator, mc, items, page) {
  const { slice, p, pageCount, total } = paginate(items, page, PER_PAGE);

  const blocks = toBlocks(slice, (it) => {
    const kind = labelForItem(it);
    const title = `**[${it.name}](${
      it.repo ? `https://github.com/${it.repo}` : "#"
    })** — ${kind}`;
    const desc = truncate(it.description, 180);

    const url = getLatestUrl(it);
    const latestLine = it.latest_release_tag
      ? url
        ? `Latest: [${it.latest_release_tag}](${url})`
        : `Latest: \`${it.latest_release_tag}\``
      : null;

    return [
      title,
      desc,
      latestLine,
      it.mc_versions ? `MC: \`${it.mc_versions}\`` : null,
    ]
      .filter(Boolean)
      .join("\n");
  });

  const embed = new EmbedBuilder()
    .setTitle(`Items by Creator: ${creator}`)
    .setDescription(blocks)
    .setFooter({
      text: `Page ${p}/${pageCount} • ${total} total${
        mc ? ` • MC ${mc}` : ""
      }`,
    });

  // Show creator avatar + link on the embed itself
  embed.setAuthor({
    name: creator,
    iconURL: items[0]?.creator?.avatar || null,
    url: `https://github.com/${encodeURIComponent(creator)}`,
  });

  const components = [];

  if (pageCount > 1) {
    const encCreator = encodeURIComponent(creator);
    const encMc = encodeURIComponent(mc || "");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`search:creator:${p - 1}:${encCreator}:${encMc}`)
        .setLabel("Previous")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(p <= 1),
      new ButtonBuilder()
        .setCustomId(`search:creator:${p + 1}:${encCreator}:${encMc}`)
        .setLabel("Next")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(p >= pageCount),
    );

    components.push(row);
  }

  return {
    embeds: [embed],
    components,
    allowedMentions: { parse: [] },
  };
}

function buildVersionPagePayload(mc, items, page) {
  const { slice, p, pageCount, total } = paginate(items, page, PER_PAGE);

  const blocks = toBlocks(slice, (it) => {
    const kind = labelForItem(it);
    const title = `**[${it.name}](${
      it.repo ? `https://github.com/${it.repo}` : "#"
    })** — ${kind}`;
    const desc = truncate(it.description, 180);

    const url = getLatestUrl(it);
    const latestLine = it.latest_release_tag
      ? url
        ? `Latest: [${it.latest_release_tag}](${url})`
        : `Latest: \`${it.latest_release_tag}\``
      : null;

    return [
      title,
      desc,
      latestLine,
      it.mc_versions ? `MC: \`${it.mc_versions}\`` : null,
    ]
      .filter(Boolean)
      .join("\n");
  });

  const embed = new EmbedBuilder()
    .setTitle(`Items supporting MC ${mc}`)
    .setDescription(blocks)
    .setFooter({
      text: `Page ${p}/${pageCount} • ${total} total`,
    });

  const components = [];

  if (pageCount > 1) {
    const encMc = encodeURIComponent(mc);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`search:version:${p - 1}:${encMc}`)
        .setLabel("Previous")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(p <= 1),
      new ButtonBuilder()
        .setCustomId(`search:version:${p + 1}:${encMc}`)
        .setLabel("Next")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(p >= pageCount),
    );

    components.push(row);
  }

  return {
    embeds: [embed],
    components,
    allowedMentions: { parse: [] },
  };
}

/* command */
module.exports = {
  data: new SlashCommandBuilder()
    .setName("search")
    .setDescription("Search Rusher plugins/themes")

    // Single-card: plugin
    .addSubcommand((sub) =>
      sub
        .setName("plugin")
        .setDescription("Show details about a plugin")
        .addStringOption((o) =>
          o
            .setName("name")
            .setDescription("Exact plugin name")
            .setRequired(true)
            .setAutocomplete(true),
        )
        .addStringOption((o) =>
          o
            .setName("mc_version")
            .setDescription("Filter by MC version (e.g., 1.21.4)"),
        ),
    )

    // Single-card: theme
    .addSubcommand((sub) =>
      sub
        .setName("theme")
        .setDescription("Show details about a theme")
        .addStringOption((o) =>
          o
            .setName("name")
            .setDescription("Exact theme name")
            .setRequired(true)
            .setAutocomplete(true),
        )
        .addStringOption((o) =>
          o
            .setName("mc_version")
            .setDescription("Filter by MC version (e.g., 1.21.4)"),
        ),
    )

    // List: by creator (button-paged)
    .addSubcommand((sub) =>
      sub
        .setName("creator")
        .setDescription("List plugins & themes by creator (paged)")
        .addStringOption((o) =>
          o
            .setName("name")
            .setDescription("Creator name")
            .setRequired(true)
            .setAutocomplete(true),
        )
        .addStringOption((o) =>
          o
            .setName("mc_version")
            .setDescription("Filter by MC version (e.g., 1.21.4)"),
        ),
    )

    // List: by version (button-paged)
    .addSubcommand((sub) =>
      sub
        .setName("version")
        .setDescription(
          "List plugins & themes that support a specific MC version (paged)",
        )
        .addStringOption((o) =>
          o
            .setName("mc_version")
            .setDescription("Minecraft version, e.g., 1.21.4")
            .setRequired(true),
        ),
    ),

  /* autocomplete */
  async autocomplete(interaction) {
    try {
      const sub = interaction.options.getSubcommand();
      const focused = (
        interaction.options.getFocused(true)?.value || ""
      ).toLowerCase();

      if (sub === "plugin") {
        const names = getPlugins()
          .map((p) => p.name)
          .filter(Boolean);

        return interaction.respond(
          names
            .filter((n) => n.toLowerCase().includes(focused))
            .slice(0, 25)
            .map((n) => ({ name: n, value: n })),
        );
      }

      if (sub === "theme") {
        const names = getThemes()
          .map((t) => t.name)
          .filter(Boolean);

        return interaction.respond(
          names
            .filter((n) => n.toLowerCase().includes(focused))
            .slice(0, 25)
            .map((n) => ({ name: n, value: n })),
        );
      }

      if (sub === "creator") {
        const creators = new Set();

        for (const p of getPlugins()) {
          if (p?.creator?.name) creators.add(p.creator.name);
        }
        for (const t of getThemes()) {
          if (t?.creator?.name) creators.add(t.creator.name);
        }

        const list = [...creators]
          .filter((n) => n.toLowerCase().includes(focused))
          .slice(0, 25);

        return interaction.respond(
          list.map((n) => ({ name: n, value: n })),
        );
      }
    } catch {
      // swallow autocomplete errors so they don't nuke the bot
    }
  },

  /* execute */
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    /* ----- /search plugin ----- */
    if (sub === "plugin") {
      const name = interaction.options.getString("name", true);
      const mc = interaction.options.getString("mc_version") || "";
      const item = getPluginByName(name);

      if (!item) {
        return interaction.reply({
          content: `No plugin found with name **${name}**.`,
          allowedMentions: { parse: [] },
        });
      }

      if (mc && !isVersionSupported(item, mc)) {
        return interaction.reply({
          content: `Plugin **${name}** does not support MC \`${mc}\`.`,
          allowedMentions: { parse: [] },
        });
      }

      const stats = await getRepoDetails(item.repo);

      const embed = await createPluginEmbed(
        item,
        interaction.user,  // user
        true,              // isPlugin
        stats,             // githubInfo
        interaction.client // client for footer avatar
      );

      // Add/override author with creator avatar + GitHub profile link
      const creatorName = item?.creator?.name;
      if (creatorName) {
        embed.setAuthor({
          name: creatorName,
          iconURL: item.creator?.avatar || null,
          url: `https://github.com/${encodeURIComponent(creatorName)}`,
        });
      }

      // Ensure we have a Latest field with clickable jar link
      const hasLatestField =
        Array.isArray(embed.data?.fields) &&
        embed.data.fields.some(
          (f) =>
            typeof f.name === "string" &&
            f.name.toLowerCase().includes("latest"),
        );

      const latestUrl = getLatestUrl(item);

      if (item.latest_release_tag && latestUrl && !hasLatestField) {
        embed.addFields({
          name: "Latest",
          value: `[${item.latest_release_tag}](${latestUrl})`,
          inline: true,
        });
      }

      return interaction.reply({ embeds: [embed] });
    }

    /* ----- /search theme ----- */
    if (sub === "theme") {
      const name = interaction.options.getString("name", true);
      const mc = interaction.options.getString("mc_version") || "";
      const item = getThemeByName(name);

      if (!item) {
        return interaction.reply({
          content: `No theme found with name **${name}**.`,
          allowedMentions: { parse: [] },
        });
      }

      if (mc && !isVersionSupported(item, mc)) {
        return interaction.reply({
          content: `Theme **${name}** does not support MC \`${mc}\`.`,
          allowedMentions: { parse: [] },
        });
      }

      const stats = await getRepoDetails(item.repo);

      const embed = await createPluginEmbed(
        item,
        interaction.user,  // user
        false,             // isPlugin = false for themes
        stats,             // githubInfo
        interaction.client // client for footer avatar
      );

      // Author: creator avatar + GitHub link
      const creatorName = item?.creator?.name;
      if (creatorName) {
        embed.setAuthor({
          name: creatorName,
          iconURL: item.creator?.avatar || null,
          url: `https://github.com/${encodeURIComponent(creatorName)}`,
        });
      }

      // Latest field with clickable jar link (if not already added)
      const hasLatestField =
        Array.isArray(embed.data?.fields) &&
        embed.data.fields.some(
          (f) =>
            typeof f.name === "string" &&
            f.name.toLowerCase().includes("latest"),
        );

      const latestUrl = getLatestUrl(item);

      if (item.latest_release_tag && latestUrl && !hasLatestField) {
        embed.addFields({
          name: "Latest",
          value: `[${item.latest_release_tag}](${latestUrl})`,
          inline: true,
        });
      }

      return interaction.reply({ embeds: [embed] });
    }

    /* ----- /search creator ----- */
    if (sub === "creator") {
      const creator = interaction.options.getString("name", true);
      const mc = interaction.options.getString("mc_version") || "";

      const items = getItemsByCreator(creator, mc);

      if (!items.length) {
        return interaction.reply({
          content: `No items found for creator **${creator}**${
            mc ? ` (MC \`${mc}\`)` : ""
          }.`,
          allowedMentions: { parse: [] },
        });
      }

      const payload = buildCreatorPagePayload(creator, mc, items, 1);
      return interaction.reply(payload);
    }

    /* ----- /search version ----- */
    if (sub === "version") {
      const mc = interaction.options.getString("mc_version", true);

      const items = getItemsByVersion(mc);

      if (!items.length) {
        return interaction.reply({
          content: `No items found for MC \`${mc}\`.`,
          allowedMentions: { parse: [] },
        });
      }

      const payload = buildVersionPagePayload(mc, items, 1);
      return interaction.reply(payload);
    }
  },

  /* button handler for pagination */
  async handleButton(interaction) {
    const id = interaction.customId || "";
    if (!id.startsWith("search:")) return;

    const parts = id.split(":");
    const mode = parts[1];
    const page = parseInt(parts[2], 10) || 1;

    try {
      if (mode === "creator") {
        const creator = decodeURIComponent(parts[3] || "");
        const mc = decodeURIComponent(parts[4] || "");

        const items = getItemsByCreator(creator, mc);
        if (!items.length) {
          return interaction.update({
            content: `No items found for creator **${creator}**${
              mc ? ` (MC \`${mc}\`)` : ""
            }.`,
            embeds: [],
            components: [],
            allowedMentions: { parse: [] },
          });
        }

        const payload = buildCreatorPagePayload(creator, mc, items, page);
        return interaction.update(payload);
      }

      if (mode === "version") {
        const mc = decodeURIComponent(parts[3] || "");

        const items = getItemsByVersion(mc);
        if (!items.length) {
          return interaction.update({
            content: `No items found for MC \`${mc}\`.`,
            embeds: [],
            components: [],
            allowedMentions: { parse: [] },
          });
        }

        const payload = buildVersionPagePayload(mc, items, page);
        return interaction.update(payload);
      }
    } catch (error) {
      console.error(
        `Error handling search pagination button: ${error.stack || error}`,
      );

      const fallback = {
        content: "❌ Failed to update page.",
        components: [],
      };

      if (interaction.deferred || interaction.replied) {
        try {
          await interaction.update(fallback);
        } catch {
          // ignore
        }
      } else {
        try {
          await interaction.reply({
            ...fallback,
            ephemeral: true,
          });
        } catch {
          // ignore
        }
      }
    }
  },
};
