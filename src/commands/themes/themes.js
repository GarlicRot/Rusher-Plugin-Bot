const { SlashCommandBuilder } = require("discord.js");
const { getThemes, getThemeByName } = require("../../utils/dataStore");
const { createPluginEmbed } = require("../../utils/embedBuilder");
const { getRepoDetails } = require("../../utils/getRepoDetails");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("theme")
    .setDescription("Get information about a theme")
    .addStringOption((option) =>
      option
        .setName("name")
        .setDescription("The theme name")
        .setRequired(true)
        .setAutocomplete(true)
    ),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused();
    const themes = getThemes();

    const filtered = themes
      .filter((theme) =>
        theme.name.toLowerCase().includes(focused.toLowerCase())
      )
      .slice(0, 25)
      .map((theme) => ({ name: theme.name, value: theme.name }));

    await interaction.respond(filtered);
  },

  async execute(interaction) {
    const name = interaction.options.getString("name");
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
  },
};
