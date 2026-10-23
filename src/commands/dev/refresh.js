const { SlashCommandBuilder, MessageFlags } = require("discord.js");
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
        flags: MessageFlags.Ephemeral,
      });
    }

    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    } catch (e) {
      console.error("Failed to defer reply:", e);
      return;
    }

    try {
      const result = await loadPluginData();

      const counts = `${result.plugins} plugins, ${result.themes} themes`;

      let message;

      if (result.source === "github") {
        message = result.cacheUpdated
          ? `✅ Registry refreshed from GitHub (${counts}).`
          : `⚠️ Registry refreshed (${counts}), but cache saving failed.`;
      } else if (result.source === "memory") {
        message = `⚠️ GitHub refresh failed. Keeping existing data (${counts}).`;
      } else {
        message = `⚠️ GitHub unavailable. Using cached data (${counts}).`;
      }

      await interaction.editReply(message);
    } catch (err) {
      console.error("Refresh failed:", err);
      await interaction.editReply("❌ Failed to refresh plugin/theme data.");
    }
  },
};
