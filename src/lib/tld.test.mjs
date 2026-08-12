/**
 * The registry is the one place that knows which domains exist and where each
 * one's tree lives. The Worker, the gate and the Astro routes all read it, so
 * a wrong answer here is wrong everywhere at once.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { byHost, crossesTree, isShared, liveTlds, tlds, toAssetPath } from "./tld.ts";

test("every entry's key matches its record key and its host is unique", () => {
  const hosts = new Set();
  for (const [key, tld] of Object.entries(tlds)) {
    assert.equal(tld.key, key, `${key} carries the wrong key`);
    assert.ok(!hosts.has(tld.host), `${tld.host} appears twice`);
    hosts.add(tld.host);
  }
});

test("a perspective tree is a slash-wrapped prefix; .io owns the root", () => {
  assert.equal(tlds.io.tree, "/");
  for (const tld of Object.values(tlds)) {
    if (tld.key === "io") continue;
    assert.match(tld.tree, /^\/[a-z]+\/$/, `${tld.key} has tree ${tld.tree}`);
  }
});

test("byHost finds a known host and returns null for anything else", () => {
  assert.equal(byHost("huvudkontoret.io")?.key, "io");
  assert.equal(byHost("huvudkontoret.name")?.key, "name");
  assert.equal(byHost("example.com"), null);
  assert.equal(byHost(""), null);
});

test("byHost ignores a port and matches case-insensitively", () => {
  assert.equal(byHost("HUVUDKONTORET.IO")?.key, "io");
  assert.equal(byHost("huvudkontoret.io:8787")?.key, "io");
});

test("only .io is live today — this step adds no domain", () => {
  assert.deepEqual(
    liveTlds().map((tld) => tld.key),
    ["io"],
  );
});

test(".ai, .app and .vote are declared not in service", () => {
  for (const key of ["ai", "app", "vote"]) {
    assert.equal(tlds[key].status, "not-in-service", `${key} should be not-in-service`);
  }
});

test("shared paths are shared, everything else is not", () => {
  assert.equal(isShared("/assets/logo_pos.svg"), true);
  assert.equal(isShared("/assets/fonts/README.md"), true);
  assert.equal(isShared("/index.html"), false);
  assert.equal(isShared("/name/magnusrenholm"), false);
});

test("a request into another domain's tree crosses a boundary", () => {
  assert.equal(crossesTree("/name/magnusrenholm", tlds.io), true);
  assert.equal(crossesTree("/cv/magnusrenholm", tlds.io), true);
  assert.equal(crossesTree("/cv/magnusrenholm", tlds.name), true);
});

test("a request inside a domain's own tree does not cross a boundary", () => {
  assert.equal(crossesTree("/", tlds.io), false);
  assert.equal(crossesTree("/index.md", tlds.io), false);
  assert.equal(crossesTree("/llms.txt", tlds.io), false);
  assert.equal(crossesTree("/magnusrenholm", tlds.name), false);
});

test("toAssetPath is the identity for .io, so its bytes are reachable unchanged", () => {
  assert.equal(toAssetPath("/", tlds.io), "/");
  assert.equal(toAssetPath("/index.md", tlds.io), "/index.md");
  assert.equal(toAssetPath("/.well-known/api-catalog", tlds.io), "/.well-known/api-catalog");
});

test("toAssetPath prefixes a perspective request with its tree", () => {
  assert.equal(toAssetPath("/magnusrenholm", tlds.name), "/name/magnusrenholm");
  assert.equal(toAssetPath("/", tlds.name), "/name/");
});
