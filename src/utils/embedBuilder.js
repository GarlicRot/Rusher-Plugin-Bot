const { EmbedBuilder } = require("discord.js");

/**
 * Safely get the bot's avatar URL for use in the footer.
 * @param {Client|null} client
 * @returns {string|null}
 */
function getBotAvatarURL(client) {
  if (!client || !client.user) return null;
  try {
    // size is optional, but keeps it nice and crisp
    return client.user.displayAvatarURL({ size: 64 });
  } catch {
    return null;
  }
}

/**
 * Creates a styled embed for a plugin or theme.
 * @param {Object} data - Plugin/theme entry from YAML.
 * @param {User} user - Discord user who triggered the command (kept for future use).
 * @param {boolean} isPlugin - Whether the data is a plugin (true) or theme (false).
 * @param {Object} [githubInfo] - Optional GitHub data (stars, lastCommit, downloadCount).
 * @param {Client} [client] - Discord client instance to fetch bot avatar.
 * @returns {EmbedBuilder}
 */
function createPluginEmbed(
  data,
  user,
  isPlugin = true,
  githubInfo = {},
  client = null
) {
  const repoUrl = `https://github.com/${data.repo}`;
  const releaseUrl = data.latest_release_tag
    ? `${repoUrl}/releases/tag/${data.latest_release_tag}`
    : `${repoUrl}/releases`;

  const embed = new EmbedBuilder()
    .setColor(data.is_core ? 0x3498db : 0x00ff88)
    .setTitle(data.name || "Unnamed Plugin")
    .setURL(repoUrl)
    .setDescription(
      typeof data.description === "string" && data.description.trim().length > 0
        ? data.description
        : "*No description provided.*"
    )
    .setFooter({
      text: "Rusher Plugin Bot",
      iconURL: getBotAvatarURL(client), // 👈 bot avatar in footer
    })
    .setTimestamp(Date.now());

  // Author (GitHub plugin creator)
  if (data.creator?.name || data.creator?.avatar) {
    embed.setAuthor({
      name: data.creator.name || "Unknown Creator",
      iconURL: data.creator.avatar || null,
    });
  }

  // Combined Plugin/Theme Info
  let combinedInfo = "";

  if (data.mc_versions) {
    combinedInfo += `**MC Versions:** ${data.mc_versions}\n`;
  }

  if (data.latest_release_tag) {
    combinedInfo += `**Latest Release:** [${data.latest_release_tag}](${releaseUrl})\n`;
  }

  if (data.is_core !== undefined) {
    combinedInfo += `**Core Plugin:** ${data.is_core ? "✅" : "❌"}\n`;
  }

  // GitHub Info Section
  const { stars, lastCommit, downloadCount } = githubInfo || {};
  let githubStats = "";

  if (stars !== undefined) {
    githubStats += `**Stars:** ${stars}\n`;
  }

  if (downloadCount !== undefined) {
    githubStats += `**Downloads:** ${downloadCount}\n`;
  }

  if (lastCommit) {
    const commitDate = new Date(lastCommit).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    githubStats += `**Last Commit:** ${commitDate}`;
  }

  // Add fields side by side
  const fields = [];

  if (combinedInfo.trim().length > 0) {
    fields.push({
      name: isPlugin ? "- Plugin Info:" : "- Theme Info:",
      value: combinedInfo.trim(),
      inline: true,
    });
  }

  if (githubStats.trim().length > 0) {
    fields.push({
      name: "- GitHub Stats:",
      value: githubStats.trim(),
      inline: true,
    });
  }

  if (fields.length > 0) {
    embed.addFields(fields);
  }

  return embed;
}

module.exports = {
  createPluginEmbed,
};
