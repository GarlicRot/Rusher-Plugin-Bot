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
    .setColor(isPlugin ? (data.is_core ? 0x3498db : 0x00ff88) : 0x9b59b6)
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
    });

  if (data.creator?.name || data.creator?.avatar) {
    embed.setAuthor({
      name: data.creator.name || "Unknown Creator",
      iconURL: data.creator.avatar || null,
    });
  }

  const fields = [];
  const infoLines = [];

  if (isPlugin && data.is_core === true) {
    infoLines.push("**Core Plugin**");
  }

  if (data.mc_versions) {
    infoLines.push(
      `**Listed MC Versions:** ${data.mc_versions}`
    );
  }

  if (infoLines.length) {
    fields.push({
      name: isPlugin ? "Plugin Details" : "Theme Details",
      value: infoLines.join("\n"),
      inline: false,
    });
  }

  const { stars, lastCommit, downloadCount } = githubInfo || {};
  const statsLines = [];

  if (Number.isFinite(stars)) {
    statsLines.push(
      `★ **Stars:** ${stars.toLocaleString("en-US")}`
    );
  }

  if (Number.isFinite(downloadCount)) {
    statsLines.push(
      `⬇ **Downloads:** ${downloadCount.toLocaleString("en-US")}`
    );
  }

  if (lastCommit) {
    const date = new Date(lastCommit);

    if (!Number.isNaN(date.getTime())) {
      const formatted = date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });

      statsLines.push(`**Last Commit:** ${formatted}`);
    }
  }

  if (statsLines.length) {
    fields.push({
      name: "GitHub",
      value: statsLines.join("\n"),
      inline: true,
    });
  }

  if (fields.length) {
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
