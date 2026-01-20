const { EmbedBuilder } = require("discord.js");

function getBotAvatarURL(client) {
  if (!client || !client.user) return null;
  try {
    return client.user.displayAvatarURL({ size: 64 });
  } catch {
    return null;
  }
}

function resolveScreenshotUrl(screenshotUrl) {
  if (!screenshotUrl || typeof screenshotUrl !== "string") return null;

  if (screenshotUrl.startsWith("http://") || screenshotUrl.startsWith("https://")) {
    return screenshotUrl;
  }

  if (screenshotUrl.startsWith("./")) {
    const RAW_BASE = "https://raw.githubusercontent.com/RusherDevelopment/rusherhack-plugins/main/";
    const filePath = screenshotUrl.replace("./", "").split(" ").join("%20");
    return RAW_BASE + filePath;
  }

  return null;
}

function createPluginEmbed(
  data,
  user,
  isPlugin = true,
  githubInfo = {},
  client = null
) {
  const repoUrl = `https://github.com/${data.repo}`;

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
      iconURL: getBotAvatarURL(client),
    })
    .setTimestamp(Date.now());

  if (data.creator?.name || data.creator?.avatar) {
    embed.setAuthor({
      name: data.creator.name || "Unknown Creator",
      iconURL: data.creator.avatar || null,
    });
  }

  let combinedInfo = "";

  if (data.mc_versions) {
    combinedInfo += `**MC Versions:** ${data.mc_versions}\n`;
  }

  if (data.is_core !== undefined) {
    combinedInfo += `**Core Plugin:** ${data.is_core ? "✅" : "❌"}\n`;
  }

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

  if (Array.isArray(data.screenshots) && data.screenshots.length > 0) {
    const screenshot = data.screenshots[Math.floor(Math.random() * data.screenshots.length)];
    const imageUrl = resolveScreenshotUrl(screenshot.url);
    if (imageUrl) {
      embed.setThumbnail(imageUrl);
    }
  }

  return embed;
}

module.exports = {
  createPluginEmbed,
};
