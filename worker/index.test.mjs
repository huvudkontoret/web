/**
 * This is the only logic in the repo that can make a live domain wrong, so it
 * is the one that gets tests. The preview URL cannot exercise Host mapping —
 * it is a single host — which makes this table the real guarantee.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import worker from "./index.ts";

/** An ASSETS binding that records what it was asked for instead of serving it. */
function fakeAssets() {
  const asked = [];
  return {
    asked,
    fetch(request) {
      asked.push(new URL(request.url).pathname);
      return Promise.resolve(new Response("asset", { status: 200 }));
    },
  };
}

async function get(url) {
  const env = { ASSETS: fakeAssets() };
  const response = await worker.fetch(new Request(url), env);
  return { status: response.status, asked: env.ASSETS.asked };
}

test(".io serves its own tree unchanged", async () => {
  assert.deepEqual(await get("https://huvudkontoret.io/"), { status: 200, asked: ["/"] });
  assert.deepEqual(await get("https://huvudkontoret.io/index.md"), { status: 200, asked: ["/index.md"] });
  assert.deepEqual(await get("https://huvudkontoret.io/llms.txt"), { status: 200, asked: ["/llms.txt"] });
});

test(".io does not answer for another domain's tree", async () => {
  const result = await get("https://huvudkontoret.io/name/magnusrenholm");
  assert.equal(result.status, 404);
  assert.deepEqual(result.asked, [], "assets must not be consulted for a refused request");
});

test("an unknown host is refused", async () => {
  const result = await get("https://example.com/");
  assert.equal(result.status, 404);
  assert.deepEqual(result.asked, []);
});

test("a registered but not-yet-live domain is refused", async () => {
  const result = await get("https://huvudkontoret.name/magnusrenholm");
  assert.equal(result.status, 404);
  assert.deepEqual(result.asked, []);
});

test("a domain declared not in service is refused", async () => {
  const result = await get("https://huvudkontoret.vote/");
  assert.equal(result.status, 404);
  assert.deepEqual(result.asked, []);
});

test("a domain we merely hold is refused like any stranger", async () => {
  const result = await get("https://huvudkontoret.wtf/");
  assert.equal(result.status, 404);
  assert.deepEqual(result.asked, []);
});

test("shared assets resolve on any live host, unprefixed", async () => {
  assert.deepEqual(await get("https://huvudkontoret.io/assets/logo_pos.svg"), {
    status: 200,
    asked: ["/assets/logo_pos.svg"],
  });
});

test("a preview URL serves prefix paths directly, as astro dev does", async () => {
  assert.deepEqual(await get("https://io-profile-web.huvudkontoret.workers.dev/name/magnusrenholm"), {
    status: 200,
    asked: ["/name/magnusrenholm"],
  });
  assert.deepEqual(await get("https://io-profile-web.huvudkontoret.workers.dev/"), {
    status: 200,
    asked: ["/"],
  });
});

test("the query string and method survive the rewrite", async () => {
  const env = { ASSETS: fakeAssets() };
  const response = await worker.fetch(new Request("https://huvudkontoret.io/index.md?v=2", { method: "HEAD" }), env);
  assert.equal(response.status, 200);
  assert.deepEqual(env.ASSETS.asked, ["/index.md"]);
});
