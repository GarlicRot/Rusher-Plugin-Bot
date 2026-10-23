const test = require("node:test");
const assert = require("node:assert/strict");
const axios = require("axios");
const { getRepoDetails } = require("../src/utils/getRepoDetails");

test("deduplicates simultaneous GitHub summary requests", async () => {
  const originalGet = axios.get;
  const pending = [];

  try {
    axios.get = (url) =>
      new Promise((resolve) => {
        pending.push({ url, resolve });
      });

    const requests = Array.from({ length: 6 }, () =>
      getRepoDetails("TestOwner/TestRepo", {
        summaryOnly: true
      })
    );

    // One repository request and one releases request.
    assert.equal(pending.length, 2);

    for (const request of pending) {
      request.resolve({
        data: request.url.includes("/releases?")
          ? [{ assets: [{ download_count: 520 }] }]
          : { stargazers_count: 4 }
      });
    }

    const results = await Promise.all(requests);

    for (const result of results) {
      assert.equal(result.stars, 4);
      assert.equal(result.downloadCount, 520);
    }

    // Completed results should use the existing cache.
    const cached = await getRepoDetails(
      "TestOwner/TestRepo",
      { summaryOnly: true }
    );

    assert.equal(cached.stars, 4);
    assert.equal(pending.length, 2);
  } finally {
    axios.get = originalGet;
  }
});

test("pauses new requests after a primary rate limit", async () => {
  const originalGet = axios.get;
  const originalNow = Date.now;
  const calls = [];
  let now = originalNow();

  try {
    Date.now = () => now;

    axios.get = async (url) => {
      calls.push(url);

      if (url.includes("/RateOwner/")) {
        const error = new Error("Rate limit exceeded");
        error.response = {
          status: 403,
          headers: {
            "x-ratelimit-remaining": "0",
            "x-ratelimit-reset": String(
              Math.floor((now + 60000) / 1000)
            )
          },
          data: { message: "API rate limit exceeded" }
        };
        throw error;
      }

      return {
        data: url.includes("/releases?")
          ? []
          : { stargazers_count: 8 }
      };
    };

    await getRepoDetails("RateOwner/RateRepo", {
      summaryOnly: true
    });

    assert.equal(calls.length, 2);

    const blocked = await getRepoDetails(
      "FreshOwner/FreshRepo",
      { summaryOnly: true }
    );

    assert.deepEqual(blocked, {});
    assert.equal(calls.length, 2);

    // Simulate the GitHub rate limit resetting.
    now += 65000;

    const recovered = await getRepoDetails(
      "FreshOwner/FreshRepo",
      { summaryOnly: true }
    );

    assert.equal(recovered.stars, 8);
    assert.equal(calls.length, 4);
  } finally {
    Date.now = originalNow;
    axios.get = originalGet;
  }
});

test("ordinary 403 errors do not trigger a rate-limit pause", async () => {
  const originalGet = axios.get;
  let calls = 0;

  try {
    axios.get = async (url) => {
      calls++;

      if (url.includes("/PermissionOwner/")) {
        const error = new Error("Forbidden");
        error.response = {
          status: 403,
          headers: {},
          data: { message: "Resource not accessible" }
        };
        throw error;
      }

      return {
        data: url.includes("/releases?")
          ? []
          : { stargazers_count: 12 }
      };
    };

    await getRepoDetails("PermissionOwner/Repo", {
      summaryOnly: true
    });

    const result = await getRepoDetails(
      "AllowedOwner/Repo",
      { summaryOnly: true }
    );

    assert.equal(result.stars, 12);
    assert.equal(calls, 4);
  } finally {
    axios.get = originalGet;
  }
});

test("preserves cached statistics during an API outage", async () => {
  const originalGet = axios.get;
  const originalNow = Date.now;
  let now = originalNow();
  let offline = false;
  let calls = 0;

  try {
    Date.now = () => now;

    axios.get = async (url) => {
      calls++;

      if (offline) throw new Error("GitHub unavailable");

      return {
        data: url.includes("/releases?")
          ? [{ assets: [{ download_count: 520 }] }]
          : { stargazers_count: 4 }
      };
    };

    const repo = "StaleOwner/RecoveryRepo";
    const options = { summaryOnly: true };

    const first = await getRepoDetails(repo, options);
    assert.equal(first.stars, 4);
    assert.equal(first.downloadCount, 520);

    now += 3600001;
    offline = true;

    const stale = await getRepoDetails(repo, options);

    assert.equal(stale.stars, 4);
    assert.equal(stale.downloadCount, 520);
    assert.equal(calls, 4);

    await getRepoDetails(repo, options);
    assert.equal(calls, 4);

    now += 30001;
    offline = false;

    const recovered = await getRepoDetails(repo, options);

    assert.equal(recovered.stars, 4);
    assert.equal(recovered.downloadCount, 520);
    assert.equal(calls, 6);
  } finally {
    Date.now = originalNow;
    axios.get = originalGet;
  }
});

test("preserves downloads when only release API fails", async () => {
  const originalGet = axios.get;
  const originalNow = Date.now;
  let now = originalNow();
  let releaseFailure = false;

  try {
    Date.now = () => now;

    axios.get = async (url) => {
      if (url.includes("/releases?")) {
        if (releaseFailure) throw new Error("Release API unavailable");

        return {
          data: [{ assets: [{ download_count: 520 }] }]
        };
      }

      return {
        data: { stargazers_count: releaseFailure ? 8 : 4 }
      };
    };

    const repo = "PartialOwner/Repo";
    const options = { summaryOnly: true };

    await getRepoDetails(repo, options);

    now += 3600001;
    releaseFailure = true;

    const updated = await getRepoDetails(repo, options);

    assert.equal(updated.stars, 8);
    assert.equal(updated.downloadCount, 520);
  } finally {
    Date.now = originalNow;
    axios.get = originalGet;
  }
});

test("uses stale statistics during GitHub rate limits", async () => {
  const originalGet = axios.get;
  const originalNow = Date.now;
  let now = originalNow();
  let calls = 0;

  try {
    Date.now = () => now;

    axios.get = async (url) => {
      calls++;

      if (url.includes("/CooldownOwner/")) {
        const error = new Error("Rate limit exceeded");
        error.response = {
          status: 403,
          headers: {
            "x-ratelimit-remaining": "0",
            "x-ratelimit-reset": String(
              Math.floor((now + 60000) / 1000)
            )
          },
          data: { message: "API rate limit exceeded" }
        };
        throw error;
      }

      return {
        data: url.includes("/releases?")
          ? [{ assets: [{ download_count: 520 }] }]
          : { stargazers_count: 4 }
      };
    };

    const repo = "CachedOwner/Repo";
    const options = { summaryOnly: true };

    await getRepoDetails(repo, options);

    now += 3600001;

    await getRepoDetails("CooldownOwner/Repo", options);

    const before = calls;
    const stale = await getRepoDetails(repo, options);

    assert.equal(stale.stars, 4);
    assert.equal(stale.downloadCount, 520);
    assert.equal(calls, before);
  } finally {
    Date.now = originalNow;
    axios.get = originalGet;
  }
});
