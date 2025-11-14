const logger = require("../utils/logger");

module.exports = {
  name: "interactionCreate",
  async execute(interaction, client) {
    try {
      // Slash commands
      if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        try {
          await command.execute(interaction);
        } catch (error) {
          logger.error(
            `Error while executing command /${interaction.commandName}: ${
              error.stack || error
            }`,
          );

          const payload = {
            content: "❌ An error occurred while processing this command.",
            ephemeral: true,
          };

          // Use editReply if we've already replied/deferred, otherwise reply
          if (interaction.deferred || interaction.replied) {
            if (typeof interaction.editReply === "function") {
              await interaction.editReply(payload).catch(() => {});
            }
          } else if (
            typeof interaction.isRepliable === "function" &&
            interaction.isRepliable()
          ) {
            await interaction.reply(payload).catch(() => {});
          }
        }
      }

      // Autocomplete interactions
      if (interaction.isAutocomplete()) {
        const command = client.commands.get(interaction.commandName);
        if (!command || typeof command.autocomplete !== "function") return;

        try {
          await command.autocomplete(interaction);
        } catch (error) {
          logger.error(
            `Autocomplete error for /${interaction.commandName}: ${
              error.stack || error
            }`,
          );
        }
      }
    } catch (outerErr) {
      // Super defensive: never let this propagate to process level
      logger.error(
        `interactionCreate handler failed: ${outerErr.stack || outerErr}`,
      );
    }
  },
};
