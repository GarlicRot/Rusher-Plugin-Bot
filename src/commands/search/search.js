const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const { createPluginEmbed } = require("../../utils/embedBuilder");
const { getRepoDetails } = require("../../utils/getRepoDetails");
const {
  getPlugins,
  getThemes,
  getPluginByName,
  getThemeByName,
} = require("../../utils/dataStore");
const axios = require("axios");

function versionCompare(v1, v2) {
  if (!v1 || !v2) return 0;
  const parts1 = v1.split(".").map(Number);
  const parts2 = v2.split(".").map(Number);
  const maxLen = Math.max(parts1.length, parts2.length);
  for (let i = 0; i < maxLen; i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  return 0;
}

function isVersionSupported(item, query) {
  if (!item.mc_versions) return false;
  const ranges = item.mc_versions.split(",").map((r) => r.trim());
  for (const range of ranges) {
    if (range.includes("-")) {
      const [start, end] = range.split("-").map((v) => v.trim());
      if (
        versionCompare(query, start) >= 0 &&
        versionCompare(query, end) <= 0
      ) {
        return true;
      }
    } else {
      if (versionCompare(query, range) === 0) {
        return true;
      }
    }
  }
  return false;
}

function expandVersionRange(start, end) {
  const versions = [];
  const startParts = start.split(".").map(Number);
  const endParts = end.split(".").map(Number);
  let [major, minor, patch = 0] = startParts;
  const [endMajor, endMinor, endPatch = 0] = endParts;
  while (
    major < endMajor ||
    (major === endMajor && minor < endMinor) ||
    (major === endMajor && minor === endMinor && patch <= endPatch)
  ) {
    versions.push(`${major}.${minor}${patch ? `.${patch}` : ""}`);
    patch++;
    if (patch > 9) {
      patch = 0;
      minor++;
    }
    if (minor > 9) {
      minor = 0;
      major++;
    }
  }
  return versions;
}

const knownVersions = [
  "1.20.1",
  "1.20.2",
  "1.20.3",
  "1.20.4",
  "1.20.5",
  "1.20.6",
  "1.21",
  "1.21.1",
  "1.21.2",
  "1.21.3",
  "1.21.4",
  "1.21.5",
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName("search")
    .setDescription("Search for plugins or themes")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("plugin")
        .setDescription("Get detailed info about a Rusher plugin")
        .addStringOption((option) =>
          option
            .setName("name")
            .setDescription("The plugin name")
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("theme")
        .setDescription("Get information about a theme")
        .addStringOption((option) =>
          option
            .setName("name")
            .setDescription("The theme name")
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("creator")
        .setDescription("List plugins and themes by a creator")
        .addStringOption((option) =>
          option
            .setName("name")
            .setDescription("The creator name")
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("version")
        .setDescription(
          "List plugins and themes compatible with a Minecraft version"
        )
        .addStringOption((option) =>
          option
            .setName("version")
            .setDescription("The Minecraft version")
            .setRequired(true)
            .setAutocomplete(true)
        )
    ),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused();
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === "plugin") {
      const plugins = getPlugins();
      const filtered = plugins
        .filter((p) => p.name.toLowerCase().includes(focused.toLowerCase()))
        .slice(0, 25)
        .map((p) => ({ name: p.name, value: p.name }));
      await interaction.respond(filtered);
    } else if (subcommand === "theme") {
      const themes = getThemes();
      const filtered = themes
        .filter((theme) =>
          theme.name.toLowerCase().includes(focused.toLowerCase())
        )
        .slice(0, 25)
        .map((theme) => ({ name: theme.name, value: theme.name }));
      await interaction.respond(filtered);
    } else if (subcommand === "creator") {
      const allItems = [...getPlugins(), ...getThemes()];
      const creators = [
        ...new Set(allItems.map((item) => item.creator?.name || "Unknown")),
      ];
      const filtered = creators
        .filter((c) => c.toLowerCase().includes(focused.toLowerCase()))
        .slice(0, 25)
        .map((c) => ({ name: c, value: c }));
      await interaction.respond(filtered);
    } else if (subcommand === "version") {
      const allItems = [...getPlugins(), ...getThemes()];
      const allVersions = new Set();
      // Add all versions from ranges and single versions
      allItems.forEach((item) => {
        if (item.mc_versions) {
          item.mc_versions.split(",").forEach((range) => {
            if (range.includes("-")) {
              const [start, end] = range.split("-").map((v) => v.trim());
              const versionsInRange = expandVersionRange(start, end);
              versionsInRange.forEach((ver) => allVersions.add(ver));
            } else {
              allVersions.add(range.trim());
            }
          });
        }
      });
      // Filter versions based on user input
      let filtered = Array.from(allVersions)
        .filter((v) => v.toLowerCase().includes(focused.toLowerCase()))
        .sort((a, b) => versionCompare(b, a)) // Sort descending for latest first
        .slice(0, 25)
        .map((v) => ({ name: v, value: v }));
      // Fallback: If no matches, show recent versions from knownVersions
      if (filtered.length === 0) {
        filtered = knownVersions
          .filter((v) => v.toLowerCase().includes(focused.toLowerCase()))
          .sort((a, b) => versionCompare(b, a))
          .slice(0, 25)
          .map((v) => ({ name: v, value: v }));
      }
      await interaction.respond(filtered);
    }
  },

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const name = interaction.options.getString("name");
    if (subcommand === "plugin") {
      const plugin = getPluginByName(name);
      if (!plugin) {
        return interaction.reply({
          content: "❌ Plugin not found.",
          ephemeral: true,
        });
      }
      const githubInfo = await getRepoDetails(plugin.repo);
      const embed = createPluginEmbed(
        plugin,
        interaction.user,
        true,
        githubInfo,
        interaction.client
      );
      await interaction.reply({ embeds: [embed] });
    } else if (subcommand === "theme") {
      const theme = getThemeByName(name);
      if (!theme) {
        return interaction.reply({
          content: "❌ Theme not found.",
          ephemeral: true,
        });
      }
      const githubInfo = await getRepoDetails(theme.repo);
      const embed = createPluginEmbed(
        theme,
        interaction.user,
        false,
        githubInfo,
        interaction.client
      );
      await interaction.reply({ embeds: [embed] });
    } else if (subcommand === "creator") {
      const creatorName = name; // cache to avoid capture confusion
      const allItems = [...getPlugins(), ...getThemes()];
      const itemsByCreator = allItems.filter(
        (item) =>
          item.creator?.name?.toLowerCase() === creatorName.toLowerCase()
      );
      if (itemsByCreator.length === 0) {
        return interaction.reply({
          content: "❌ No plugins or themes found for creator: " + creatorName,
          ephemeral: true,
        });
      }
      const creatorUrl =
        itemsByCreator[0].creator?.url || `https://github.com/${creatorName}`;
      let avatarUrl = null;
      try {
        const response = await axios.get(
          `https://api.github.com/users/${creatorName}`,
          {
            headers: { Authorization: `token ${process.env.GITHUB_TOKEN}` },
          }
        );
        avatarUrl = response.data.avatar_url;
      } catch (error) {
        console.warn(
          `Failed to fetch avatar for ${creatorName}:`,
          error.message
        );
      }
      const perPage = 5;
      let page = 0;
      const totalPages = Math.ceil(itemsByCreator.length / perPage);
      const generateEmbed = async (page) => {
        const embed = new EmbedBuilder()
          .setTitle(
            `Items by Creator: ${creatorName} (${itemsByCreator.length} found)`
          )
          .setDescription(`[View GitHub Profile](${creatorUrl})`)
          .setColor(0x00ff88)
          .setFooter({
            text: `Page ${page + 1}/${totalPages}`,
            iconURL: interaction.client.user.displayAvatarURL(),
          });
        if (avatarUrl) {
          embed.setThumbnail(avatarUrl);
        }
        const start = page * perPage;
        for (const item of itemsByCreator.slice(start, start + perPage)) {
          const isPlugin = getPlugins().includes(item);
          const coreLabel = isPlugin && item.is_core ? " (Core)" : "";
          const repoUrl = `https://github.com/${item.repo}`;
          const shortDesc =
            item.description?.substring(0, 100) +
              (item.description?.length > 100 ? "..." : "") || "No description";
          embed.addFields({
            name: "•",
            value: `[${item.name}${coreLabel} – ${
              isPlugin ? "Plugin" : "Theme"
            }](${repoUrl})\n${shortDesc}`,
            inline: false,
          });
        }
        return embed;
      };
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("prev")
          .setLabel("◀️")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === 0),
        new ButtonBuilder()
          .setCustomId("next")
          .setLabel("▶️")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === totalPages - 1)
      );
      await interaction.reply({
        embeds: [await generateEmbed(page)],
        components: totalPages > 1 ? [row] : [],
      });
      if (totalPages <= 1) return;
      const collector = interaction.channel.createMessageComponentCollector({
        filter: (i) =>
          i.user.id === interaction.user.id &&
          ["prev", "next"].includes(i.customId),
        time: 300000,
      });
      collector.on("collect", async (i) => {
        if (i.customId === "prev") page--;
        if (i.customId === "next") page++;
        await i.update({
          embeds: [await generateEmbed(page)],
          components: [
            row.setComponents(
              row.components[0].setDisabled(page === 0),
              row.components[1].setDisabled(page === totalPages - 1)
            ),
          ],
        });
      });
      collector.on("end", () =>
        interaction.editReply({ components: [] }).catch(() => {})
      );
    } else if (subcommand === "version") {
      const queryVersion = interaction.options.getString("version");
      const allItems = [...getPlugins(), ...getThemes()];
      const itemsForVersion = allItems.filter((item) =>
        isVersionSupported(item, queryVersion)
      );
      if (itemsForVersion.length === 0) {
        return interaction.reply({
          content: `❌ No plugins or themes found for version: ${queryVersion}`,
          ephemeral: true,
        });
      }
      const perPage = 5;
      let page = 0;
      const totalPages = Math.ceil(itemsForVersion.length / perPage);
      const generateEmbed = (page) => {
        const embed = new EmbedBuilder()
          .setTitle(
            `Items for Minecraft Version: ${queryVersion} (${itemsForVersion.length} found)`
          )
          .setColor(0x00ff88)
          .setFooter({
            text: `Page ${page + 1}/${totalPages}`,
            iconURL: interaction.client.user.displayAvatarURL(),
          });
        const start = page * perPage;
        for (const item of itemsForVersion.slice(start, start + perPage)) {
          const isPlugin = getPlugins().includes(item);
          const coreLabel = isPlugin && item.is_core ? " (Core)" : "";
          const repoUrl = `https://github.com/${item.repo}`;
          const shortDesc =
            item.description?.substring(0, 100) +
              (item.description?.length > 100 ? "..." : "") || "No description";
          embed.addFields({
            name: "•",
            value: `[${item.name}${coreLabel} – ${
              isPlugin ? "Plugin" : "Theme"
            }](${repoUrl})\n${shortDesc}`,
            inline: false,
          });
        }
        return embed;
      };
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("prev")
          .setLabel("◀️")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === 0),
        new ButtonBuilder()
          .setCustomId("next")
          .setLabel("▶️")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === totalPages - 1)
      );
      await interaction.reply({
        embeds: [generateEmbed(page)],
        components: totalPages > 1 ? [row] : [],
      });
      if (totalPages <= 1) return;
      const collector = interaction.channel.createMessageComponentCollector({
        filter: (i) =>
          i.user.id === interaction.user.id &&
          ["prev", "next"].includes(i.customId),
        time: 300000,
      });
      collector.on("collect", async (i) => {
        if (i.customId === "prev") page--;
        if (i.customId === "next") page++;
        await i.update({
          embeds: [generateEmbed(page)],
          components: [
            row.setComponents(
              row.components[0].setDisabled(page === 0),
              row.components[1].setDisabled(page === totalPages - 1)
            ),
          ],
        });
      });
      collector.on("end", () =>
        interaction.editReply({ components: [] }).catch(() => {})
      );
    }
  },
};
