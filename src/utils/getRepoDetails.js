const axios = require("axios");

const GITHUB_API = "https://api.github.com";
const CACHE_TTL = 10 * 60 * 1000;
const SUMMARY_CACHE_TTL = 60 * 60 * 1000;
const cache = new Map();

async function getRepoDetails(repoSlug, { summaryOnly = false } = {}) {
  if (
    typeof repoSlug !== "string" ||
    !/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repoSlug)
  ) {
    return {};
  }

  const key = `${repoSlug.toLowerCase()}:${summaryOnly ? "summary" : "full"}`;
  const cached = cache.get(key);

  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }

  const headers = {
    "User-Agent": "RusherPluginBot",
    "Accept": "application/vnd.github+json",
  };

  const token = process.env.GITHUB_TOKEN?.trim();

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const config = {
    headers,
    timeout: 7000,
  };

  const base = `${GITHUB_API}/repos/${repoSlug}`;

  const requests = [
    axios.get(base, config),
    axios.get(`${base}/releases?per_page=100`, config),
  ];

  if (!summaryOnly) {
    requests.push(axios.get(`${base}/commits?per_page=1`, config));
  }

  const results = await Promise.allSettled(requests);
  const stats = {};

  const [repo, releases, commits] = results;

  if (repo.status === "fulfilled") {
    const stars = repo.value.data.stargazers_count;
    if (Number.isFinite(stars)) {
      stats.stars = stars;
    }
  }

  if (
    releases.status === "fulfilled" &&
    Array.isArray(releases.value.data)
  ) {
    const list = releases.value.data;

    // Avoid claiming a complete total when releases
    // extend beyond the first API page.
    if (list.length < 100) {
      stats.downloadCount = list.reduce(
        (total, release) =>
          total + (release.assets || []).reduce(
            (sum, asset) => sum + (asset.download_count || 0),
            0
          ),
        0
      );
    }
  }

  if (commits?.status === "fulfilled") {
    const date =
      commits.value.data[0]?.commit?.committer?.date;

    if (date) {
      stats.lastCommit = date;
    }
  }

  const labels = ["repository", "releases", "commits"];

  results.forEach((result, index) => {
    if (result.status === "rejected") {
      const error = result.reason;
      console.warn(
        `[GitHub] ${repoSlug} ${labels[index]} failed: ` +
        (error.response?.status || error.message)
      );
    }
  });

  cache.set(key, {
    data: stats,
    expires: Date.now() +
      (Object.keys(stats).length ? (summaryOnly ? SUMMARY_CACHE_TTL : CACHE_TTL) : 30000),
  });

  return stats;
}

module.exports = { getRepoDetails };
