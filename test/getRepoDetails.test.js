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
