/**
 * The registry is the one place that knows which domains exist and where each
 * one's tree lives. The Worker, the gate and the Astro routes all read it, so
 * a wrong answer here is wrong everywhere at once.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { parseJsonc } from "../../tools/check/lib/jsonc.mjs";

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

test(".io and .club are live, and nothing else is", () => {
  assert.deepEqual(
    liveTlds().map((tld) => tld.key),
    ["io", "club"],
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
 * docs/runbooks/2026-08-24-domain-activation.md. Buying or dropping a
 * `huvudkontoret.*` domain has to come here, and this test is what makes
 * forgetting expensive.
 *
 * Scoped to `huvudkontoret.*` on purpose. This file is the address doctrine —
 * one name seen through many top-level domains — not a ledger of everything
 * the company owns. The Cloudflare account already holds `lulea.ai`, which is
 * a different name and belongs to no perspective here; claiming it would make
 * this table a billing report and the doctrine harder to read.
 */
test("the registry holds every huvudkontoret.* domain and no others", () => {
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
 *
 * `.club` is the one exception, and it is named rather than absorbed: the
 * canon's domain register made it a lens on 2026-09-11 and "Club v2" designed
 * its page, but .io's list has not taken it up. A tenth entry here needs the
 * same two things — a row in that register and a page to serve.
 */
test("the lens set is the eight addresses .io announces, plus .club", () => {
  const lenses = Object.values(tlds)
    .filter((tld) => tld.kind !== "undecided")
    .map((tld) => tld.key)
    .sort();
  assert.deepEqual(lenses, ["ai", "app", "club", "cv", "dev", "io", "name", "vote", "xyz"]);
});

/**
 * `wrangler deploy` creates every custom domain it finds in wrangler.jsonc, so
 * a route is a cutover and a registry row without one is a domain the Worker
 * would answer for and never be asked about. The two are one decision. This is
 * the check the registry's own header promises: a row and a route arrive
 * together, or the gate fails.
 */
test("every live domain has a custom-domain route, and no other host has one", () => {
  const config = parseJsonc(readFileSync(new URL("../../wrangler.jsonc", import.meta.url), "utf8"));
  for (const route of config.routes ?? []) {
    assert.equal(
      route.custom_domain,
      true,
      `${JSON.stringify(route)} is not a custom-domain route — every route here is a domain this Worker owns`,
    );
  }
  const routed = (config.routes ?? [])
    .filter((route) => route.custom_domain)
    .map((route) => route.pattern)
    .sort();
  assert.deepEqual(
    routed,
    routableTlds().map((tld) => tld.host).sort(),
    "wrangler.jsonc and the registry disagree about which domains this Worker serves",
  );
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
 * Cloudflare refuses a Worker custom domain on a zone it does not own. The
 * zones moved into our account on 2026-08-26, so the front can now carry a
 * route — but the rule is what matters, not the current answer: a domain whose
 * DNS still answers elsewhere must never be treated as routable.
 */
test("only a zone we own can carry a route", () => {
  assert.deepEqual(
    routableTlds().map((tld) => tld.key),
    ["io", "club"],
  );
  assert.equal(canBeRouted(tlds.io), true);

  for (const tld of Object.values(tlds)) {
    if (tld.delegation !== "cloudflare-hk") {
      assert.equal(canBeRouted(tld), false, `${tld.key} answers at ${tld.delegation} and cannot be routed`);
    }
  }
});

test(".io's zone has moved into our own account", () => {
  assert.equal(tlds.io.status, "live");
  assert.equal(tlds.io.delegation, "cloudflare-hk");
});

/**
 * The backlog emptied on 2026-08-26, when the last of the twenty-four moved.
 * Asserting that it is empty is worth more than asserting what used to be in
 * it: the next domain that arrives delegated somewhere else fails here, which
 * is the moment someone should notice rather than three steps later when its
 * route will not attach.
 */
test("nothing is waiting on delegation", () => {
  assert.deepEqual(
    awaitingDelegation().map((tld) => tld.key),
    [],
    "a domain with a role is delegated somewhere other than our Cloudflare account",
  );

  // Held names are excluded by construction, not by luck — they are not
  // waiting on anything, they are just owned.
  for (const tld of Object.values(tlds)) {
    if (tld.status === "held") {
      assert.ok(!awaitingDelegation().includes(tld), `${tld.key} is held and cannot be in the backlog`);
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
