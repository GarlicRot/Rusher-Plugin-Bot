module.exports = {
  name: "interactionCreate",
  async execute(interaction, client) {
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      try {
        await command.execute(interaction);
      } catch (error) {
        console.error(error);
        await interaction
          .editReply({
            content: "❌ An error occurred while processing this command.",
            ephemeral: true,
          })
          .catch(() =>
            interaction.followUp({
              content: "❌ An error occurred.",
              ephemeral: true,
            })
          );
      }
    }
    // Handle autocomplete interactions
    if (interaction.isAutocomplete()) {
      const command = client.commands.get(interaction.commandName);
      if (!command || !command.autocomplete) return;
      try {
        await command.autocomplete(interaction);
      } catch (error) {
        console.error("Autocomplete error:", error);
      }
    }
  },
};
