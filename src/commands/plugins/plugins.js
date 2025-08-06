const { SlashCommandBuilder } = require("discord.js");
const { createPluginEmbed } = require("../../utils/embedBuilder");
const { getRepoDetails } = require("../../utils/getRepoDetails");
const path = require("path");
const yaml = require("js-yaml");
const fs = require("fs");

const DATA_PATH = path.join(__dirname, "../../cache/plugins-and-themes.yml");

// Utility to load the plugin list
function loadPluginList() {
  const raw = fs.readFileSync(DATA_PATH, "utf8");
  return yaml.load(raw)?.plugins || [];
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("plugin")
    .setDescription("Get detailed info about a Rusher plugin")
    .addStringOption((option) =>
      option
        .setName("name")
        .setDescription("The plugin name")
        .setRequired(true)
        .setAutocomplete(true)
    ),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused();
    const plugins = loadPluginList();

    const choices = plugins
      .filter((p) => p.name.toLowerCase().includes(focused.toLowerCase()))
      .slice(0, 25)
      .map((p) => ({ name: p.name, value: p.name }));

    await interaction.respond(choices);
  },

  async execute(interaction) {
    const name = interaction.options.getString("name");
    const plugins = loadPluginList();
    const plugin = plugins.find(
      (p) => p.name.toLowerCase() === name.toLowerCase()
    );

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
  },
};
