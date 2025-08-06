const axios = require("axios");

const GITHUB_API = "https://api.github.com";

async function getRepoDetails(repoSlug) {
  const headers = {
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
    "User-Agent": "RusherPluginBot",
  };

  const repoUrl = `${GITHUB_API}/repos/${repoSlug}`;
  const releasesUrl = `${repoUrl}/releases?per_page=100`; // up to 100 releases
  const commitsUrl = `${repoUrl}/commits?per_page=1`;

  try {
    const [repoRes, releasesRes, commitRes] = await Promise.all([
      axios.get(repoUrl, { headers }),
      axios.get(releasesUrl, { headers }),
      axios.get(commitsUrl, { headers }),
    ]);

    const stars = repoRes.data.stargazers_count || 0;
    const lastCommit = commitRes.data[0]?.commit?.committer?.date || null;

    // Sum download counts from all releases
    let totalDownloads = 0;
    for (const release of releasesRes.data) {
      if (release.assets && release.assets.length > 0) {
        for (const asset of release.assets) {
          totalDownloads += asset.download_count || 0;
        }
      }
    }

    return {
      stars,
      lastCommit,
      downloadCount: totalDownloads,
    };
  } catch (err) {
    console.error(`GitHub API error for ${repoSlug}:`, err.message);
    return {
      stars: 0,
      lastCommit: null,
      downloadCount: 0,
    };
  }
}

module.exports = { getRepoDetails };
