module.exports = {
  name: "interactionCreate",
  async execute(interaction, client) {
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;

      try {
        await command.execute(interaction, client);
      } catch (error) {
        console.error("Command execution error:", error);

        // Attempt to send error message as editReply or followUp
        try {
          if (interaction.deferred || interaction.replied) {
            await interaction.editReply({
              content: "❌ An error occurred while processing this command.",
            });
          } else {
            await interaction.reply({
              content: "❌ An error occurred while processing this command.",
              ephemeral: 64,
            });
          }
        } catch (err) {
          console.error("Failed to send error reply:", err);
        }
      }
    }

    // Handle autocomplete interactions
    if (interaction.isAutocomplete()) {
      const command = client.commands.get(interaction.commandName);
      if (!command || !command.autocomplete) return;

      try {
        await command.autocomplete(interaction, client);
      } catch (error) {
        console.error("Autocomplete error:", error);
      }
    }

    // Handle component interactions
    if (interaction.isMessageComponent()) {
      if (!interaction.channel) {
        console.warn(
          "❌ Cannot handle message component: interaction.channel is null."
        );
        return;
      }
    }
  },
};
