const axios = require("axios");

const GITHUB_API = "https://api.github.com";
const CACHE_TTL = 10 * 60 * 1000;
const SUMMARY_CACHE_TTL = 60 * 60 * 1000;
const cache = new Map();
const inFlight = new Map();
let rateLimitUntil = 0;

// Distinguish GitHub rate limits from ordinary permission errors.
function recordRateLimit(error) {
  const response = error?.response;

  if (![403, 429].includes(response?.status)) return;

  const headers = response.headers || {};
  const remaining = String(headers["x-ratelimit-remaining"] ?? "");
  const reset = Number(headers["x-ratelimit-reset"]);
  const retryHeader = headers["retry-after"];
  const retryAfter = Number(retryHeader);
  const message = String(response.data?.message || "");

  const isLimited =
    remaining === "0" ||
    response.status === 429 ||
    retryHeader !== undefined ||
    /secondary rate limit|abuse detection/i.test(message);

  if (!isLimited) return;

  const now = Date.now();
  const deadlines = [];

  if (
    remaining === "0" &&
    Number.isFinite(reset) &&
    reset > 0
  ) {
    deadlines.push(reset * 1000 + 1000);
  }

  if (
    retryHeader !== undefined &&
    Number.isFinite(retryAfter) &&
    retryAfter >= 0
  ) {
    deadlines.push(now + Math.max(1000, retryAfter * 1000));
  }

  const until = deadlines.length
    ? Math.max(now + 1000, ...deadlines)
    : now + 60000;

  if (until > rateLimitUntil) {
    rateLimitUntil = until;

    console.warn(
      `[GitHub] Rate limited; pausing requests until ` +
      new Date(until).toISOString()
    );
  }
}

async function fetchRepoDetails(repoSlug, { summaryOnly = false } = {}) {
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

  // Cached data remains available during a GitHub cooldown.
  if (Date.now() < rateLimitUntil) {
    return {};
  }

  rateLimitUntil = 0;

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
      recordRateLimit(error);
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

// Share ongoing requests for the same repository and mode.
async function getRepoDetails(repoSlug, { summaryOnly = false } = {}) {
  if (
    typeof repoSlug !== "string" ||
    !/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repoSlug)
  ) {
    return {};
  }

  const key = `${repoSlug.toLowerCase()}:${summaryOnly ? "summary" : "full"}`;

  const existing = inFlight.get(key);
  if (existing) {
    return existing;
  }

  const request = fetchRepoDetails(repoSlug, { summaryOnly });
  inFlight.set(key, request);

  try {
    return await request;
  } finally {
    inFlight.delete(key);
  }
}

module.exports = { getRepoDetails };
