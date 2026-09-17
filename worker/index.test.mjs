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

test("homepage negotiation honors explicit media types, quality and browser defaults", async () => {
  const cases = [
    [null, "/"],
    ["*/*", "/"],
    ["text/*", "/"],
    ["text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", "/"],
    ["text/markdown", "/index.md"],
    ["text/markdown, text/html", "/index.md"],
    ["TEXT/MARKDOWN; charset=UTF-8", "/index.md"],
    ["text/markdown;q=0.9, text/html;q=0.5", "/index.md"],
    ["text/markdown;q=0.5, text/html;q=0.9", "/"],
    ["text/markdown;q=0", "/"],
    ["text/markdown;q=0, */*", "/"],
    ["text/markdown;q=0.5, */*;q=0.8", "/"],
    ["text/markdown;q=0.5, text/html;q=0, */*", "/index.md"],
    ["text/markdown;q=0.5, text/*;q=0.2, */*", "/index.md"],
    ["text/markdown;q=invalid", "/"],
    ["text/markdown;q=2", "/"],
    ["text/markdown;q=0.1234", "/"],
    ["text/markdown;variant=unsupported", "/"],
    ["text/markdownish", "/"],
  ];
  for (const [accept, expected] of cases) {
    const env = { ASSETS: fakeAssets() };
    const response = await worker.fetch(new Request("https://huvudkontoret.io/", {
      headers: accept === null ? {} : { Accept: accept },
    }), env);
    assert.deepEqual(env.ASSETS.asked, [expected], String(accept));
    assert.equal(response.headers.get("Vary"), "Accept");
    assert.equal(response.headers.get("Content-Signal"), "search=yes, ai-input=yes, ai-train=no");
    assert.equal(response.headers.get("Link"), '</.well-known/api-catalog>; rel="api-catalog", </llms.txt>; rel="describedby"');
    if (expected === "/index.md") assert.equal(response.headers.get("Content-Type"), "text/markdown; charset=utf-8");
    assert.equal(await response.text(), "asset");
  }
});

test("Markdown works for homepage aliases, previews and local development with GET and HEAD", async () => {
  for (const host of ["huvudkontoret.io", "agent-web.huvudkontoret.workers.dev", "localhost:8787", "127.0.0.1:8787"]) {
    for (const path of ["/", "/index.html"]) {
      for (const method of ["GET", "HEAD"]) {
        const env = { ASSETS: {
          async fetch(request) {
            assert.equal(new URL(request.url).pathname, "/index.md");
            assert.equal(new URL(request.url).search, "?source=agent");
            assert.equal(request.method, method);
            assert.equal(request.headers.get("If-None-Match"), '"markdown-version"');
            return new Response(method === "HEAD" ? null : "# Huvudkontoret\n", {
              headers: { ETag: '"markdown-version"', "Cache-Control": "public, max-age=0, must-revalidate", Vary: "Accept-Encoding" },
            });
          },
        } };
        const response = await worker.fetch(new Request(`http://${host}${path}?source=agent`, {
          method, headers: { Accept: "text/markdown", "If-None-Match": '"markdown-version"' },
        }), env);
        assert.equal(response.headers.get("Vary"), "Accept-Encoding, Accept");
        assert.equal(response.headers.get("ETag"), '"markdown-version"');
        assert.equal(response.headers.get("Cache-Control"), "public, max-age=0, must-revalidate");
        assert.equal(await response.text(), method === "HEAD" ? "" : "# Huvudkontoret\n");
      }
    }
  }
});

test("negotiation preserves asset statuses and never relabels errors as Markdown", async () => {
  for (const status of [206, 304, 404, 500]) {
    const response = await worker.fetch(new Request("https://huvudkontoret.io/", {
      headers: { Accept: "text/markdown" },
    }), { ASSETS: { async fetch() {
      return new Response(status === 304 ? null : "body", {
        status, headers: { "Content-Type": "text/plain", Vary: "Accept" },
      });
    } } });
    assert.equal(response.status, status);
    assert.equal(response.headers.get("Vary"), "Accept");
    assert.equal(response.headers.get("Content-Type"), status < 400 ? "text/markdown; charset=utf-8" : "text/plain");
  }
});

test("negotiation does not rewrite other resources or POST requests", async () => {
  for (const [path, method] of [["/profil", "GET"], ["/assets/logo_pos.svg", "GET"], ["/index.md", "GET"], ["/missing", "GET"], ["/", "POST"]]) {
    const env = { ASSETS: fakeAssets() };
    await worker.fetch(new Request(`https://huvudkontoret.io${path}`, {
      method, headers: { Accept: "text/markdown" },
    }), env);
    assert.deepEqual(env.ASSETS.asked, [path]);
  }
});
