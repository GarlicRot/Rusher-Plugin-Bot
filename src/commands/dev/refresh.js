const { SlashCommandBuilder } = require("discord.js");
const { loadPluginData } = require("../../utils/dataStore");

const DEV_USER_ID = "119982148945051651";

module.exports = {
  data: new SlashCommandBuilder()
    .setName("refresh")
    .setDescription("Reload the plugin and theme data from GitHub"),

  async execute(interaction) {
    if (interaction.user.id !== DEV_USER_ID) {
      return interaction.reply({
        content: "❌ You are not authorized to use this command.",
        ephemeral: true,
      });
    }

    try {
      await interaction.deferReply({ ephemeral: true });
    } catch (e) {
      console.error("Failed to defer reply:", e);
      return;
    }

    try {
      await loadPluginData();
      await interaction.editReply(
        "✅ Plugin and theme data refreshed from GitHub."
      );
    } catch (err) {
      console.error("Refresh failed:", err);
      await interaction.editReply("❌ Failed to refresh plugin/theme data.");
    }
  },
};
