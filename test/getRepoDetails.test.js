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
