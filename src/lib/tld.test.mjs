/**
 * The registry is the one place that knows which domains exist and where each
 * one's tree lives. The Worker, the gate and the Astro routes all read it, so
 * a wrong answer here is wrong everywhere at once.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  awaitingDelegation,
  byHost,
  canBeRouted,
  crossesTree,
  isShared,
  liveTlds,
  routableTlds,
  tlds,
  toAssetPath,
} from "./tld.ts";

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

/**
 * The registry is the inventory, not a wishlist. Reconciled against DNS, RDAP
 * and the registrars on 2026-08-24 — see
 * docs/runbooks/2026-08-24-domain-activation.md. Buying or dropping a domain
 * has to come here, and this test is what makes forgetting expensive.
 */
test("the registry holds every domain Huvudkontoret owns and no others", () => {
  assert.deepEqual(
    Object.keys(tlds).sort(),
    [
      "ai",
      "app",
      "blog",
      "cloud",
      "club",
      "cv",
      "dev",
      "email",
      "info",
      "io",
      "link",
      "name",
      "news",
      "one",
      "online",
      "sh",
      "site",
      "store",
      "systems",
      "tech",
      "vote",
      "website",
      "wtf",
      "xyz",
    ],
    "the estate changed — reconcile the runbook and this list together",
  );
});

/**
 * `.io` publishes the lens set in its SYSTEMET section. That page is the
 * authority (ADR 0002), so this list changing means the page changed first —
 * and if it did not, the registry is wrong.
 */
test("the lens set is exactly the eight addresses .io announces", () => {
  const lenses = Object.values(tlds)
    .filter((tld) => tld.kind !== "undecided")
    .map((tld) => tld.key)
    .sort();
  assert.deepEqual(lenses, ["ai", "app", "cv", "dev", "io", "name", "vote", "xyz"]);
});

test("a held domain is not a lens and a lens is not held", () => {
  for (const tld of Object.values(tlds)) {
    assert.equal(
      tld.status === "held",
      tld.kind === "undecided",
      `${tld.key} is ${tld.status} but kind ${tld.kind} — held and lens are the same distinction`,
    );
  }
});

test("every domain declares a tree of its own", () => {
  const trees = Object.values(tlds).map((tld) => tld.tree);
  assert.equal(new Set(trees).size, trees.length, "two domains claim the same tree");
});

test("a held domain has no content designed for it", () => {
  for (const tld of Object.values(tlds)) {
    if (tld.status !== "held") continue;
    assert.equal(tld.kind, "undecided", `${tld.key} is held but claims kind ${tld.kind}`);
  }
});

/**
 * Cloudflare refuses a Worker custom domain on a zone it does not own, and
 * Huvudkontoret's account holds no zones yet. Until the zone move lands, this
 * is the truthful state of the world, and the assertion below is what stops a
 * route from being added on top of a delegation that cannot carry it.
 */
test("nothing is routable yet — every zone still answers somewhere else", () => {
  assert.deepEqual(routableTlds(), []);
  assert.equal(canBeRouted(tlds.io), false);
});

test(".io is blocked on the zone move, not on intent", () => {
  assert.equal(tlds.io.status, "live");
  assert.equal(tlds.io.delegation, "cloudflare-sharpest");
});

test("the activation backlog is every domain with a role and the wrong DNS home", () => {
  const backlog = awaitingDelegation().map((tld) => tld.key);
  assert.ok(backlog.includes("io"), "the front is in the backlog until its zone moves");
  for (const tld of Object.values(tlds)) {
    if (tld.status === "held") {
      assert.ok(!backlog.includes(tld.key), `${tld.key} is held and is not waiting on anything`);
    }
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
