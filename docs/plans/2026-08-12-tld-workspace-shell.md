# TLD workspace, step 1: the shell — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve `huvudkontoret.io` from an Astro build through a Host-routing Worker, with the published site byte-identical to today and no new domain added.

**Architecture:** `.io` moves verbatim into `public/`, which Astro copies into `dist/` untouched. `src/lib/tld.ts` becomes the single source of truth about the domains. `worker/index.ts` maps Host to a tree and refuses cross-tree requests. `wrangler.jsonc` points at `dist` with `run_worker_first`. The gate stops asking `.assetsignore` what the site is and starts asserting what `dist/` actually contains.

**Tech Stack:** Astro 6 (static), Cloudflare Workers with static assets, Node's built-in test runner, no test framework and no dependencies in `tools/`.

## Blocking prerequisite

**The Pages → Workers route flip must be merged and verified before this plan's pull request merges.**

This is not a preference. Task 3 removes `index.html` from the repo root, and the repo root is what GitHub Pages serves behind the `huvudkontoret.io` CNAME. Merging this work while Pages is still production takes the live site down.

Verified 2026-08-12: `huvudkontoret.io` resolves to `185.199.111.153` and friends — GitHub Pages. `wrangler.jsonc` has no `routes` entry and `facts.json` has `expectCustomDomain: false`. The route flip is still outstanding.

Before starting Task 3, confirm all three:

```bash
dig +short A huvudkontoret.io          # must NOT be 185.199.x.x
curl -sI https://huvudkontoret.io | grep -i '^server:'   # must not say GitHub.com
grep expectCustomDomain tools/check/facts.json           # must be true
```

Tasks 1 and 2 touch nothing that is served and may be done before the flip.

## Global Constraints

- **English in every artifact** — code, identifiers, comments, docs, commit messages, PR text. Swedish only in published product content (`public/index.html` and the agent surfaces).
- **Conventional commits**, one pull request per slice, trunk-based on `main`.
- **`tools/` stays dependency-free.** No test framework, no build step, no lockfile entry. Node's `node:test` and `node:assert` only.
- **The published surface must not change.** `.io` serves byte-identical bytes at identical paths before and after. This is the acceptance test for the whole step.
- **Do not add the apex route to `wrangler.jsonc`.** That is the separate cutover change, guarded by the `expectCustomDomain` interlock.
- **Node floor is 24.** Local is v26.7.0 and imports `.ts` from `.mjs` with no flag; CI currently pins `node-version: "22"`, which cannot. Task 1 raises it.
- **All tasks land as one pull request.** Intermediate commits leave the repo in a state that must never reach production — after Task 3 the repo root has no `index.html`, and before Task 5 `wrangler.jsonc` still points at `.`. Production deploys only from `main`, so this is safe as long as nothing is merged mid-plan.

## File structure

| File | Responsibility |
|---|---|
| `src/lib/tld.ts` | The registry. Domain facts and path arithmetic. No Astro, no styling, no I/O. |
| `src/lib/tld.test.mjs` | Registry tests. |
| `worker/index.ts` | Host → tree routing, cross-tree refusal, `workers.dev` bypass. Nothing else. |
| `worker/index.test.mjs` | Routing table tests against a fake `ASSETS` binding. |
| `public/` | `.io` verbatim: `index.html`, agent surfaces, `.well-known/`, `assets/`. Frozen. |
| `astro.config.mjs`, `package.json` | The build. |
| `tools/check/lib/dist.mjs` | Reads the built output from the filesystem — `dist/` is gitignored, so `lib/site.mjs` cannot see it. |
| `tools/check/checks/output.mjs` | Asserts what `dist/` contains. Replaces `.assetsignore` as the answer to "what is the site?". |
| `tools/check/lib/site.mjs` | Gains a site-root prefix so the existing checks follow `.io` into `public/`. |

---

### Task 1: The TLD registry

**Files:**
- Create: `src/lib/tld.ts`
- Test: `src/lib/tld.test.mjs`
- Modify: `.github/workflows/pr.yml:34` (Node 22 → 24), `hk.json:5` (test command)

**Interfaces:**
- Consumes: nothing.
- Produces: `type Tld = { key: string; host: string; kind: 'static' | 'perspective' | 'surface'; tree: string; status: 'live' | 'planned' | 'not-in-service' }`; `tlds: Readonly<Record<string, Tld>>`; `SHARED_PATHS: readonly string[]`; `byHost(host: string): Tld | null`; `liveTlds(): Tld[]`; `isShared(pathname: string): boolean`; `crossesTree(pathname: string, tld: Tld): boolean`; `toAssetPath(pathname: string, tld: Tld): string`. Task 2 consumes all of these. Task 5 consumes `tlds` and `liveTlds`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/tld.test.mjs`:

```js
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
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `node --test src/lib/tld.test.mjs`
Expected: FAIL — `Cannot find module` for `./tld.ts`.

- [ ] **Step 3: Write the registry**

Create `src/lib/tld.ts`:

```ts
/**
 * The domains, as data.
 *
 * Five consumers read this file: the Worker, the Astro routes, the agent
 * surface generators, the gate and the documentation. Adding a domain is a row
 * here plus a route in wrangler.jsonc — and the gate fails if one arrives
 * without the other.
 *
 * This file is bundled into the Worker, so it must import neither Astro nor
 * Tailwind and must do no I/O. Routing facts live here; presentation lives in
 * tokens.ts. The Worker never needs to know what colour .cv is.
 */

/** What the Worker does with a domain — not what the registrar thinks. */
export type TldStatus =
  /** Routed and served. */
  | "live"
  /** Registered and intended, but not yet delegated to Cloudflare or routed. */
  | "planned"
  /** Registered and publicly announced as not running. */
  | "not-in-service";

export type TldKind =
  /** Hand-written and byte-exact: the company front. */
  | "static"
  /** A lens on a shared node — render(node, perspective). */
  | "perspective"
  /** Own content that does not live in a person node. */
  | "surface";

export interface Tld {
  readonly key: string;
  readonly host: string;
  readonly kind: TldKind;
  /** Where this domain's bytes live in the build. `.io` owns the root. */
  readonly tree: string;
  readonly status: TldStatus;
}

/**
 * Served identically on every host. All ten domains share one set of logos,
 * fonts and sigills; without this they would each 404 on /assets/.
 * Astro's own per-perspective output lands under <tree>/_astro/ and is not
 * shared.
 */
export const SHARED_PATHS: readonly string[] = ["/assets/"];

export const tlds = {
  io: { key: "io", host: "huvudkontoret.io", kind: "static", tree: "/", status: "live" },
  name: { key: "name", host: "huvudkontoret.name", kind: "perspective", tree: "/name/", status: "planned" },
  cv: { key: "cv", host: "huvudkontoret.cv", kind: "perspective", tree: "/cv/", status: "planned" },
  dev: { key: "dev", host: "huvudkontoret.dev", kind: "perspective", tree: "/dev/", status: "planned" },
  link: { key: "link", host: "huvudkontoret.link", kind: "perspective", tree: "/link/", status: "planned" },
  blog: { key: "blog", host: "huvudkontoret.blog", kind: "surface", tree: "/blog/", status: "planned" },
  club: { key: "club", host: "huvudkontoret.club", kind: "surface", tree: "/club/", status: "planned" },
  ai: { key: "ai", host: "huvudkontoret.ai", kind: "perspective", tree: "/ai/", status: "not-in-service" },
  app: { key: "app", host: "huvudkontoret.app", kind: "surface", tree: "/app/", status: "not-in-service" },
  vote: { key: "vote", host: "huvudkontoret.vote", kind: "surface", tree: "/vote/", status: "not-in-service" },
} as const satisfies Record<string, Tld>;

export type TldKey = keyof typeof tlds;

const byHostIndex = new Map<string, Tld>(Object.values(tlds).map((tld) => [tld.host, tld]));

/** The Host header carries case and sometimes a port; neither identifies a domain. */
export function byHost(host: string): Tld | null {
  if (!host) return null;
  const bare = host.toLowerCase().split(":")[0];
  return byHostIndex.get(bare) ?? null;
}

export function liveTlds(): Tld[] {
  return Object.values(tlds).filter((tld) => tld.status === "live");
}

export function isShared(pathname: string): boolean {
  return SHARED_PATHS.some((prefix) => pathname.startsWith(prefix));
}

/**
 * True when the path reaches into a domain that is not this one. `.io` owns the
 * root, so for it this means any other domain's prefix; for a perspective it
 * means any prefix that is not its own.
 */
export function crossesTree(pathname: string, tld: Tld): boolean {
  return Object.values(tlds).some(
    (other) => other.key !== tld.key && other.tree !== "/" && pathname.startsWith(other.tree),
  );
}

/** Where in the build this host-relative path actually lives. */
export function toAssetPath(pathname: string, tld: Tld): string {
  return `${tld.tree}${pathname.slice(1)}`;
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `node --test src/lib/tld.test.mjs`
Expected: PASS, 11 tests.

- [ ] **Step 5: Raise the Node floor so CI can read TypeScript**

In `.github/workflows/pr.yml`, change line 34 from `node-version: "22"` to `node-version: "24"`. Node strips types without a flag from 23.6; on 22 the import in Step 1 fails outright, so this is what makes the registry testable in CI at all.

Then change the `Self-tests` step (line 38-39) to run both suites:

```yaml
      - name: Self-tests
        run: node --test tools/check/test.mjs src/lib/tld.test.mjs
```

- [ ] **Step 6: Point hk at the same command**

In `hk.json`, change the `test` command so `hk verify web` and CI stay the same thing:

```json
  "test": "node --test tools/check/test.mjs src/lib/tld.test.mjs && node tools/check/run.mjs",
```

- [ ] **Step 7: Verify the whole gate is still green**

Run: `node --test tools/check/test.mjs src/lib/tld.test.mjs && node tools/check/run.mjs && node tools/check/run.mjs --format`
Expected: all suites pass, `6 checks passed`, `1 checks passed`.

- [ ] **Step 8: Commit**

```bash
git add src/lib/tld.ts src/lib/tld.test.mjs .github/workflows/pr.yml hk.json
git commit -m "feat: add the TLD registry as the single source of truth about the domains"
```

---

### Task 2: The Worker

**Files:**
- Create: `worker/index.ts`
- Test: `worker/index.test.mjs`
- Modify: `.github/workflows/pr.yml` (add the new suite), `hk.json` (same)

**Interfaces:**
- Consumes: from Task 1 — `byHost`, `crossesTree`, `isShared`, `toAssetPath`.
- Produces: a default export `{ fetch(request: Request, env: { ASSETS: { fetch(request: Request): Promise<Response> } }): Promise<Response> }`. Task 5 wires it up as `main` in `wrangler.jsonc`.

- [ ] **Step 1: Write the failing test**

Create `worker/index.test.mjs`:

```js
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
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `node --test worker/index.test.mjs`
Expected: FAIL — `Cannot find module` for `./index.ts`.

- [ ] **Step 3: Write the Worker**

Create `worker/index.ts`:

```ts
/**
 * One Worker, every domain.
 *
 * The Host header names the perspective; the path names the thing. This maps
 * the first onto a subtree of the build and refuses anything that reaches into
 * a neighbouring domain, so huvudkontoret.io/name/x is a 404 rather than a
 * second address for the same page.
 *
 * assets.run_worker_first must stay true in wrangler.jsonc. Workers serve
 * static assets ahead of the script by default, which would answer that exact
 * request out of dist/ and never reach the rule below.
 */

import { byHost, crossesTree, isShared, toAssetPath } from "../src/lib/tld.ts";

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
}

/**
 * Preview URLs are a single host — <branch>-web.<subdomain>.workers.dev — and
 * cannot carry ten domains. There they behave like `astro dev`: prefix paths,
 * served directly. Previews therefore do not exercise Host mapping, which is
 * why worker/index.test.mjs is the real guarantee. See ADR 0002.
 */
function isPreviewHost(host: string): boolean {
  return host.toLowerCase().split(":")[0].endsWith(".workers.dev");
}

function notFound(): Response {
  return new Response("Not found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (isPreviewHost(url.hostname)) return env.ASSETS.fetch(request);

    const tld = byHost(url.host);
    if (!tld || tld.status !== "live") return notFound();

    if (isShared(url.pathname)) return env.ASSETS.fetch(request);
    if (crossesTree(url.pathname, tld)) return notFound();

    const target = new URL(url);
    target.pathname = toAssetPath(url.pathname, tld);
    return env.ASSETS.fetch(new Request(target, request));
  },
};
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `node --test worker/index.test.mjs`
Expected: PASS, 8 tests.

- [ ] **Step 5: Add the suite to CI and hk**

`.github/workflows/pr.yml`, the `Self-tests` step:

```yaml
        run: node --test tools/check/test.mjs src/lib/tld.test.mjs worker/index.test.mjs
```

`hk.json`:

```json
  "test": "node --test tools/check/test.mjs src/lib/tld.test.mjs worker/index.test.mjs && node tools/check/run.mjs",
```

- [ ] **Step 6: Commit**

```bash
git add worker/index.ts worker/index.test.mjs .github/workflows/pr.yml hk.json
git commit -m "feat: route each domain to its own tree in a Worker"
```

---

### Task 3: Move `.io` into `public/` and give the repo a build

**Files:**
- Create: `package.json`, `astro.config.mjs`
- Move (with `git mv`, unchanged): `index.html`, `index.md`, `llms.txt`, `llms-full.txt`, `robots.txt`, `sitemap.xml`, `demo-hero.html`, `.well-known/`, `assets/` → `public/`
- Modify: `tools/check/lib/site.mjs`, `tools/check/facts.json`, `tools/check/test.mjs`
- Leave at the repo root: `CNAME`, `.nojekyll` (ADR 0001 keeps them until the cutover is verified), `tools/`, `docs/`, `wrangler.jsonc`, `.assetsignore`

**Interfaces:**
- Consumes: nothing from Tasks 1-2.
- Produces: a `dist/` directory whose contents equal the current published set byte for byte. Tasks 4 and 5 assert against it. `loadSite(root, sitePrefix)` gains a second parameter; `site.read` and `site.has` resolve through it while `site.tracked` stays repo-relative.

**Verified before writing this task:** Astro 6 builds with an empty `src/pages/` — it reports `0 page(s) built` and completes — and copies `public/` into `dist/` byte-identically, with nothing else added. So this task needs no placeholder page.

- [ ] **Step 1: Capture the current published bytes as the thing to preserve**

```bash
mkdir -p /tmp/io-before
for f in index.html index.md llms.txt llms-full.txt robots.txt sitemap.xml; do
  cp "$f" "/tmp/io-before/$f"
done
cp -R .well-known assets /tmp/io-before/
find /tmp/io-before -type f | wc -l
```

Note the count. Step 8 compares against this.

- [ ] **Step 2: Write the failing test for the relocated site root**

In `tools/check/test.mjs`, change `baseline()` so every site file lives under `public/` while `CNAME`, `.nojekyll`, `.gitignore`, `wrangler.jsonc` and `.assetsignore` stay at the root. Rename the keys only — the content is unchanged:

```js
    "CNAME": "huvudkontoret.io\n",
    ".nojekyll": "",
    ".gitignore": "assets/fonts/*.woff2\n",
    "public/index.html": [
      "<!doctype html>",
      '<html lang="sv">',
      "<head><title>Huvudkontoret</title></head>",
      "<body>",
      '  <nav><a href="#contact">Kontakt</a></nav>',
      '  <img src="assets/logo.svg" alt="Logotyp">',
      `  <p>${TEAM}</p>`,
      `  <section id="contact">${CONTACT}</section>`,
      "</body>",
      "</html>",
      "",
    ].join("\n"),
    "public/index.md": `# Huvudkontoret\n\n${TEAM}\n\n${CONTACT}\n`,
    "public/llms.txt": `# Huvudkontoret\n\n${TEAM}\n\n${CONTACT}\n`,
    "public/robots.txt": "User-agent: *\nAllow: /\n\nContent-Signal: search=yes, ai-input=yes, ai-train=no\nSitemap: https://huvudkontoret.io/sitemap.xml\n",
    "public/sitemap.xml": '<?xml version="1.0" encoding="UTF-8"?>\n<urlset><url><loc>https://huvudkontoret.io/</loc></url></urlset>\n',
    "public/assets/logo.svg": '<svg xmlns="http://www.w3.org/2000/svg"></svg>\n',
```

And make `findings()` load the site with the prefix:

```js
function findings(check, files, facts = FACTS) {
  const collected = [];
  check.run(loadSite(fixtureRoot(files), FACTS.siteDir), facts, {
    fail: (where, message) => collected.push({ where, message }),
  });
  return collected;
}
```

- [ ] **Step 3: Run the gate's tests and confirm they fail**

Run: `node --test tools/check/test.mjs`
Expected: FAIL — `publishing`, `references`, `markup` and `surfaces` all report missing files, because they still look for `index.html` at the root.

- [ ] **Step 4: Teach `loadSite` where the site lives**

In `tools/check/lib/site.mjs`, replace the exported `loadSite` with a prefixed version. `tracked` stays repo-relative — the font and `neverPublished` scans are about the repository, not the site:

```js
export function loadSite(root, siteDir = "") {
  const cache = new Map();

  const tracked = new Set(
    execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 })
      .split("\0")
      .filter(Boolean),
  );

  /** Site-relative paths resolve inside siteDir; the repo is still the repo. */
  const inSite = (relativePath) => (siteDir ? `${siteDir}${relativePath}` : relativePath);

  function read(relativePath) {
    const key = inSite(relativePath);
    if (!cache.has(key)) {
      try {
        cache.set(key, readFileSync(join(root, key), "utf8"));
      } catch {
        cache.set(key, null);
      }
    }
    return cache.get(key);
  }

  return {
    root,
    siteDir,
    tracked,
    read,
    /** Tracked, not merely present on disk. */
    has: (relativePath) => tracked.has(inSite(relativePath)),
    trackedMatching: (pattern) => [...tracked].filter((file) => pattern.test(file)),
    /** Repo-root files that are not part of the site: CNAME, .nojekyll. */
    readRepoFile: (relativePath) => {
      if (!cache.has(relativePath)) {
        try {
          cache.set(relativePath, readFileSync(join(root, relativePath), "utf8"));
        } catch {
          cache.set(relativePath, null);
        }
      }
      return cache.get(relativePath);
    },
    hasRepoFile: (relativePath) => tracked.has(relativePath),
  };
}
```

- [ ] **Step 5: Point the two repo-root checks at the repo, not the site**

`CNAME` and `.nojekyll` are GitHub Pages artifacts at the repo root, not part of the site. In `tools/check/checks/publishing.mjs`, change the three places that read them:

```js
  for (const file of facts.requiredFiles) {
    if (!site.has(file)) {
      report.fail(file, "required in the site directory — this is what the build publishes");
    }
  }

  for (const file of facts.requiredRepoFiles) {
    if (!site.hasRepoFile(file)) {
      report.fail(file, "required at the repo root until the Pages cutover is verified — see ADR 0001");
    }
  }

  const cname = (site.readRepoFile("CNAME") ?? "").trim();
```

and

```js
  if (!site.hasRepoFile(".nojekyll")) {
```

In `tools/check/facts.json`, split the list and name the site directory:

```json
  "siteDir": "public/",
  "requiredFiles": ["index.html", "index.md", "llms.txt", "robots.txt", "sitemap.xml"],
  "requiredRepoFiles": ["CNAME", ".nojekyll"],
```

In `tools/check/run.mjs`, pass the directory through:

```js
  const site = loadSite(options.root, facts.siteDir);
```

- [ ] **Step 6: Run the gate's tests and confirm they pass**

Run: `node --test tools/check/test.mjs`
Expected: PASS, 36 tests.

- [ ] **Step 7: Move the site**

```bash
mkdir -p public
git mv index.html index.md llms.txt llms-full.txt robots.txt sitemap.xml demo-hero.html public/
git mv .well-known public/.well-known
git mv assets public/assets
```

- [ ] **Step 8: Add the build**

Create `package.json`:

```json
{
  "name": "huvudkontoret-web",
  "type": "module",
  "private": true,
  "engines": {
    "node": ">=24.0.0"
  },
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview"
  },
  "dependencies": {
    "astro": "^6.3.2"
  }
}
```

Create `astro.config.mjs`:

```js
// @ts-check
import { defineConfig } from "astro/config";

/**
 * There are no pages yet, and that is deliberate: this step moves .io into
 * public/ unchanged and adds no perspective. Astro copies public/ into dist/
 * byte for byte, so dist/ is the site and nothing else — which is what lets
 * .assetsignore go away in Task 5.
 */
export default defineConfig({
  site: "https://huvudkontoret.io",
});
```

Then install and build:

```bash
npm install
npm run build
```

- [ ] **Step 9: Prove the published bytes did not change**

```bash
diff -r /tmp/io-before dist && echo "IDENTICAL"
```

Expected: `IDENTICAL`, no output from `diff`. Anything else means the move changed the site, and this task is not done. Note that `demo-hero.html` is excluded from publishing today and will be handled in Task 5 — if `diff` reports it as `Only in dist`, that is expected and is the one permitted difference.

- [ ] **Step 10: Run the whole gate**

Run: `node --test tools/check/test.mjs src/lib/tld.test.mjs worker/index.test.mjs && node tools/check/run.mjs && node tools/check/run.mjs --format`
Expected: all suites pass, `6 checks passed`, `1 checks passed`.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "refactor: move the site into public/ and build it with Astro"
```

---

### Task 4: Teach the gate to read the built output

**Files:**
- Create: `tools/check/lib/dist.mjs`, `tools/check/checks/output.mjs`
- Modify: `tools/check/run.mjs` (a `--output` mode), `tools/check/test.mjs`, `tools/check/facts.json`

**Interfaces:**
- Consumes: from Task 1 — `liveTlds`. From Task 3 — a `dist/` directory.
- Produces: `loadDist(root): { root, files: Set<string>, has(path), read(path) }` and a check module `{ name: "output", summary, run(dist, facts, report) }`. Task 5 puts it in the default run.

**Why a second reader:** `lib/site.mjs` answers `git ls-files`, deliberately — a reference that resolves only on the author's machine is the failure it exists to catch. But `dist/` is gitignored and generated, so it has no git answer at all. Two questions, two readers.

- [ ] **Step 1: Write the failing test**

Append to `tools/check/test.mjs`:

```js
import * as output from "./checks/output.mjs";
import { loadDist } from "./lib/dist.mjs";

/** A throwaway dist/ holding `files`. No git — dist is generated, not tracked. */
function distRoot(files) {
  const root = mkdtempSync(join(tmpdir(), "web-dist-"));
  fixtures.push(root);
  for (const [path, content] of Object.entries(files)) {
    if (content === null) continue;
    mkdirSync(join(root, "dist", dirname(path)), { recursive: true });
    writeFileSync(join(root, "dist", path), content);
  }
  return root;
}

function distFindings(files, facts = FACTS) {
  const collected = [];
  output.run(loadDist(distRoot(files)), facts, {
    fail: (where, message) => collected.push({ where, message }),
  });
  return collected;
}

/** The built site, as Task 3 produces it. */
function builtBaseline() {
  return {
    "index.html": "<!doctype html>\n",
    "index.md": "# Huvudkontoret\n",
    "llms.txt": "# Huvudkontoret\n",
    "llms-full.txt": "# Huvudkontoret\n",
    "robots.txt": "User-agent: *\nSitemap: https://huvudkontoret.io/sitemap.xml\n",
    "sitemap.xml": "<urlset></urlset>\n",
    ".well-known/api-catalog": "{}\n",
    "assets/logo_pos.svg": "<svg></svg>\n",
  };
}

test("output: the built site passes", () => {
  assert.deepEqual(distFindings(builtBaseline()), []);
});

test("output: a file that is not part of the site is a finding", () => {
  const found = distFindings({ ...builtBaseline(), "CLAUDE.md": "instructions\n" });
  assert.ok(
    found.some((finding) => `${finding.where} ${finding.message}`.includes("not part of the site")),
    `expected a finding, got: ${JSON.stringify(found, null, 2)}`,
  );
});

test("output: a missing agent surface is a finding", () => {
  const files = builtBaseline();
  delete files["llms.txt"];
  const found = distFindings(files);
  assert.ok(
    found.some((finding) => `${finding.where} ${finding.message}`.includes("agent surfaces depend on")),
    `expected a finding, got: ${JSON.stringify(found, null, 2)}`,
  );
});

test("output: a licensed font in the build is a finding", () => {
  const found = distFindings({ ...builtBaseline(), "assets/fonts/MonoLisa-Regular.woff2": "binary" });
  assert.ok(
    found.some((finding) => `${finding.where} ${finding.message}`.includes("licensed font")),
    `expected a finding, got: ${JSON.stringify(found, null, 2)}`,
  );
});

test("output: a missing dist is a finding, not a silent pass", () => {
  const root = mkdtempSync(join(tmpdir(), "web-nodist-"));
  fixtures.push(root);
  const collected = [];
  output.run(loadDist(root), FACTS, { fail: (where, message) => collected.push({ where, message }) });
  assert.ok(
    collected.some((finding) => finding.message.includes("no dist/")),
    `expected a finding, got: ${JSON.stringify(collected, null, 2)}`,
  );
});
```

- [ ] **Step 2: Run and confirm it fails**

Run: `node --test tools/check/test.mjs`
Expected: FAIL — `Cannot find module './checks/output.mjs'`.

- [ ] **Step 3: Write the dist reader**

Create `tools/check/lib/dist.mjs`:

```js
/**
 * The built output, as the gate sees it.
 *
 * lib/site.mjs asks git what exists, on purpose. dist/ is generated and
 * gitignored, so git has no answer about it — this reads the filesystem
 * instead. It is the only place in the gate that does.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

function walk(directory, into) {
  for (const entry of readdirSync(directory)) {
    const full = join(directory, entry);
    if (statSync(full).isDirectory()) walk(full, into);
    else into.push(full);
  }
}

export function loadDist(root) {
  const base = join(root, "dist");
  const files = new Set();
  let present = true;

  try {
    const found = [];
    walk(base, found);
    for (const file of found) files.add(relative(base, file).split(sep).join("/"));
  } catch {
    present = false;
  }

  return {
    root: base,
    present,
    files,
    has: (path) => files.has(path),
    read(path) {
      try {
        return readFileSync(join(base, path), "utf8");
      } catch {
        return null;
      }
    },
  };
}
```

- [ ] **Step 4: Write the output check**

Create `tools/check/checks/output.mjs`:

```js
/**
 * What the Worker actually publishes.
 *
 * Until now the answer was .assetsignore: everything in the repo was served
 * unless a line excluded it, which made publishing opt-out and a new file at
 * the repo root one commit away from being live. dist/ inverts that — only
 * what public/ holds or the build emits is there at all. This check asserts
 * the result rather than trusting the mechanism.
 */

import { matchesAny } from "../lib/patterns.mjs";

export const name = "output";
export const summary = "the build contains exactly the site";

export function run(dist, facts, report) {
  if (!dist.present) {
    report.fail("dist", "no dist/ — run `npm run build` before the output checks; there is nothing to verify");
    return;
  }

  for (const file of [...dist.files].sort()) {
    if (!matchesAny(facts.publishedPaths, file)) {
      report.fail(
        `dist/${file}`,
        "would be served from the site but is not part of it — keep it out of public/, " +
          "or add it to publishedPaths in facts.json if it genuinely belongs on the site",
      );
    }
  }

  for (const required of facts.requiredPublished) {
    if (!dist.has(required)) {
      report.fail(`dist/${required}`, "missing from the build, and the site and its agent surfaces depend on it");
    }
  }

  // Wrangler uploads the working directory, not the git tree, so keeping the
  // fonts out of git does not keep them off the site — Astro copies public/
  // into dist/ regardless. This is the rule that does. See ADR 0001.
  const licensed = new RegExp(facts.licensedFontPattern);
  for (const file of dist.files) {
    if (licensed.test(file)) {
      report.fail(
        `dist/${file}`,
        "licensed font is in the build — a deploy would publish it. Keep the .woff2 files out of public/ " +
          "until the MonoLisa web licence is confirmed.",
      );
    }
  }
}
```

- [ ] **Step 5: Add the `--output` mode**

In `tools/check/run.mjs`, add the import, the check list, the flag and the branch:

```js
import * as output from "./checks/output.mjs";
import { loadDist } from "./lib/dist.mjs";
```

```js
const OUTPUT_CHECKS = [output];
```

In `parseArguments`, beside `--format`:

```js
    else if (argument === "--output") options.output = true;
```

In `main`, after the facts are read, branch on the mode:

```js
  const checks = options.format ? FORMAT_CHECKS : options.output ? OUTPUT_CHECKS : CONTENT_CHECKS;
  const subject = options.output ? loadDist(options.root) : loadSite(options.root, facts.siteDir);
  const report = createReport();

  for (const check of checks) {
    check.run(subject, facts, report.forCheck(check));
  }
```

- [ ] **Step 6: Run the tests and confirm they pass**

Run: `node --test tools/check/test.mjs`
Expected: PASS, 41 tests.

- [ ] **Step 7: Run the output check against the real build**

Run: `npm run build && node tools/check/run.mjs --output`
Expected: `1 checks passed`. If `demo-hero.html` is reported, remove it from `public/` — it is excluded from publishing today and has no reason to enter the build:

```bash
git rm public/demo-hero.html
```

- [ ] **Step 8: Commit**

```bash
git add tools/check/lib/dist.mjs tools/check/checks/output.mjs tools/check/run.mjs tools/check/test.mjs tools/check/facts.json
git commit -m "feat: assert what the build publishes instead of what the ignore file excludes"
```

---

### Task 5: Point Wrangler at the build and retire `.assetsignore`

**Files:**
- Modify: `wrangler.jsonc`, `tools/check/checks/workers.mjs`, `tools/check/facts.json`, `tools/check/test.mjs`
- Delete: `.assetsignore`

**Interfaces:**
- Consumes: from Task 1 — `liveTlds`. From Task 2 — `worker/index.ts` as the entry point. From Task 4 — the `output` check.
- Produces: the deployable configuration. Task 6 documents it.

**This is one commit on purpose.** The `workers` check asserts `assets.directory === "."` and fails without `.assetsignore`. Changing the configuration and changing what the gate expects are the same decision, exactly as `expectCustomDomain` and the apex route are — the gate must never be green on a half-done flip.

- [ ] **Step 1: Write the failing test**

In `tools/check/test.mjs`, replace the `.assetsignore` line in `baseline()` with `null` and change the `wrangler.jsonc` fixture to the new shape:

```js
    "wrangler.jsonc": [
      "{",
      '  // The site is the build; https://example.com/ in a comment must not confuse the parser.',
      '  "name": "web",',
      '  "main": "worker/index.ts",',
      '  "assets": { "directory": "dist", "binding": "ASSETS", "run_worker_first": true },',
      '  "preview_urls": true,',
      "}",
      "",
    ].join("\n"),
    ".assetsignore": null,
```

Then replace the four `.assetsignore` tests with the ones that matter now:

```js
test("workers: an assets directory that is not the build is a finding", () => {
  assertFires(
    workers,
    { "wrangler.jsonc": baseline()["wrangler.jsonc"].replace('"directory": "dist"', '"directory": "."') },
    'expected "dist"',
  );
});

test("workers: serving assets ahead of the script is a finding", () => {
  // Without run_worker_first the Worker never sees huvudkontoret.io/name/x —
  // it is answered straight out of dist/ and the isolation quietly stops
  // existing.
  assertFires(
    workers,
    { "wrangler.jsonc": baseline()["wrangler.jsonc"].replace('"run_worker_first": true', '"run_worker_first": false') },
    "run_worker_first",
  );
});

test("workers: a missing script entry point is a finding", () => {
  assertFires(
    workers,
    { "wrangler.jsonc": baseline()["wrangler.jsonc"].replace('"main": "worker/index.ts",', "") },
    "main",
  );
});

test("workers: a live domain without a route is a finding", () => {
  // The registry says .io is live; wrangler.jsonc must agree, or the domain is
  // live in the code and dark in production.
  assertFires(workers, {}, "huvudkontoret.io");
});

test("workers: a route for a domain the registry does not call live is a finding", () => {
  assertFires(
    workers,
    {
      "wrangler.jsonc": baseline()["wrangler.jsonc"].replace(
        '"preview_urls": true,',
        '"preview_urls": true,\n  "routes": [{ "pattern": "huvudkontoret.cv", "custom_domain": true }],',
      ),
    },
    "huvudkontoret.cv",
  );
});
```

Note the fourth test asserts a finding against the unmodified baseline, because the baseline has no routes while the registry calls `.io` live. Once the route flip has landed on `main` (the blocking prerequisite), add the apex route to the baseline fixture and invert that test to `assertClean`.

- [ ] **Step 2: Run and confirm it fails**

Run: `node --test tools/check/test.mjs`
Expected: FAIL — the current `workers` check still demands `.assetsignore` and `directory: "."`.

- [ ] **Step 3: Rewrite the workers check**

Replace `tools/check/checks/workers.mjs` entirely:

```js
/**
 * The Cloudflare side of publishing.
 *
 * The asset directory is the build, so "what is the site?" is answered by what
 * Astro puts in dist/ — checks/output.mjs asserts that. What is left here is
 * the configuration that has to hold for the routing to mean anything: the
 * script runs, it runs first, and the domains the registry calls live are the
 * domains this file routes.
 */

import { liveTlds } from "../../src/lib/tld.ts";
import { parseJsonc } from "../lib/jsonc.mjs";

export const name = "workers";
export const summary = "the Worker configuration matches the registry";

export function run(site, facts, report) {
  const text = site.readRepoFile("wrangler.jsonc");
  if (text === null) {
    report.fail("wrangler.jsonc", "missing — this is what serves the site");
    return;
  }

  let config;
  try {
    config = parseJsonc(text);
  } catch (error) {
    report.fail("wrangler.jsonc", `does not parse: ${error.message}`);
    return;
  }

  if (config.assets?.directory !== "dist") {
    report.fail(
      "wrangler.jsonc",
      `assets.directory is ${JSON.stringify(config.assets?.directory)}, expected "dist" — the site is the build`,
    );
  }

  if (!config.main) {
    report.fail("wrangler.jsonc", "no main — without the script every host would be served the same tree");
  }

  if (config.assets?.binding !== "ASSETS") {
    report.fail("wrangler.jsonc", 'assets.binding is not "ASSETS" — the Worker fetches the build through it');
  }

  // Workers serve static assets ahead of the script by default, which would
  // answer huvudkontoret.io/name/x out of dist/ before the Worker could refuse
  // it. This flag is what makes the isolation real.
  if (config.assets?.run_worker_first !== true) {
    report.fail(
      "wrangler.jsonc",
      "assets.run_worker_first is not true — static assets would be served ahead of the script, so cross-domain " +
        "requests would resolve instead of 404",
    );
  }

  if (config.preview_urls !== true) {
    report.fail(
      "wrangler.jsonc",
      "preview_urls is not true — pull requests would get no browsable preview. " +
        "Note this setting is re-applied on every deploy, so the dashboard toggle alone does not hold.",
    );
  }

  checkRoutes(config, report);
}

/**
 * The registry and the routes are one decision. A domain that is live in
 * src/lib/tld.ts and absent here is live in the code and dark in production;
 * a route here for a domain the registry does not serve is a domain the Worker
 * will answer 404 for, on its own custom domain.
 */
function checkRoutes(config, report) {
  const routed = new Set((config.routes ?? []).filter((route) => route.custom_domain).map((route) => route.pattern));
  const live = new Set(liveTlds().map((tld) => tld.host));

  for (const host of live) {
    if (!routed.has(host)) {
      report.fail(
        "wrangler.jsonc",
        `src/lib/tld.ts calls ${host} live but there is no custom_domain route for it. ` +
          "Adding the route performs the cutover on the next production deploy — see " +
          "docs/runbooks/2026-08-12-pages-to-workers-cutover.md.",
      );
    }
  }

  for (const host of routed) {
    if (!live.has(host)) {
      report.fail(
        "wrangler.jsonc",
        `routes ${host}, which src/lib/tld.ts does not call live — the Worker would answer 404 on its own domain`,
      );
    }
  }
}
```

- [ ] **Step 4: Update the facts**

In `tools/check/facts.json`, drop the keys the ignore file needed and keep the published set, which `output.mjs` now uses:

```json
  "publishedPaths": [
    "index.html",
    "index.md",
    "llms.txt",
    "llms-full.txt",
    "robots.txt",
    "sitemap.xml",
    ".well-known/",
    "assets/"
  ],
  "requiredPublished": ["index.html", "index.md", "llms.txt", "robots.txt", "sitemap.xml"],
```

Delete `expectCustomDomain` and its `//expectCustomDomain` note: the registry's `status` now carries that decision, and `checkRoutes` is the interlock.

Also delete `addressesNotInService`. It is a second list of the same fact — `[".ai", ".app", ".vote"]` — and the registry already says which domains are not in service. Two lists of one fact drift.

- [ ] **Step 4b: Read the not-in-service addresses out of the registry**

In `tools/check/checks/surfaces.mjs`, replace the read of `facts.addressesNotInService` with the registry. Add the import at the top:

```js
import { tlds } from "../../src/lib/tld.ts";
```

and derive the list where the check currently reads the fact:

```js
  const addressesNotInService = Object.values(tlds)
    .filter((tld) => tld.status === "not-in-service")
    .map((tld) => `.${tld.key}`);
```

The surface rule is unchanged: an address the site announces but does not run must never be presented as live. Only where the list comes from changes.

Run: `node --test tools/check/test.mjs`
Expected: PASS — the existing not-in-service cases still fire, now driven by the registry. If a case fails because a fixture referenced an address that is not in the registry, the fixture is what is wrong: the registry is now the only place a domain exists.

- [ ] **Step 5: Rewrite `wrangler.jsonc`**

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "web",
  "compatibility_date": "2026-05-12",
  "observability": {
    "enabled": true
  },
  // The Host header names the perspective and the script maps it onto a
  // subtree of the build. src/lib/tld.ts is the source of truth for which
  // domains exist; the gate fails if a live domain there has no route here.
  "main": "worker/index.ts",
  "assets": {
    "directory": "dist",
    "binding": "ASSETS",
    // Workers serve static assets ahead of the script by default, which would
    // answer huvudkontoret.io/name/x straight out of dist/ and never reach the
    // cross-tree refusal. Every request costs a Worker invocation as a result;
    // at this traffic that is nothing, and narrowing it to a pattern list is an
    // optimisation available later without touching the script.
    "run_worker_first": true
    // not_found_handling is deliberately unset: the default returns a plain
    // 404, which is what this site has always done.
  },
  // www keeps its 301 to the apex through a zone redirect rule rather than a
  // second custom domain. See docs/runbooks/2026-08-12-pages-to-workers-cutover.md.
  "routes": [{ "pattern": "huvudkontoret.io", "custom_domain": true }],
  // Every pull request gets a preview at <branch>-web.<subdomain>.workers.dev.
  // Restricted with Cloudflare Access — the previews show unreleased work.
  // A preview is one host and cannot carry ten domains, so the Worker serves
  // prefix paths there instead of mapping Host. See ADR 0002.
  "preview_urls": true
}
```

**If the route flip has not landed on `main` yet, stop here.** Leave the `routes` entry out, set `.io` to `status: "planned"` in `src/lib/tld.ts`, and note it in the pull request. The gate stays green either way, because `checkRoutes` compares the two rather than hard-coding one.

- [ ] **Step 6: Delete the ignore file**

```bash
git rm .assetsignore
```

- [ ] **Step 7: Run everything**

```bash
node --test tools/check/test.mjs src/lib/tld.test.mjs worker/index.test.mjs
npm run build
node tools/check/run.mjs
node tools/check/run.mjs --output
node tools/check/run.mjs --format
```

Expected: all suites pass; `6 checks passed`, `1 checks passed`, `1 checks passed`. The content list is unchanged at six — `workers` was rewritten, not removed, and `fonts` still guards the git tree.

- [ ] **Step 8: Verify the routing end to end**

```bash
npx wrangler dev --port 8787
```

In another shell:

```bash
curl -s -o /dev/null -w '%{http_code}\n' -H 'Host: huvudkontoret.io' http://127.0.0.1:8787/
curl -s -o /dev/null -w '%{http_code}\n' -H 'Host: huvudkontoret.io' http://127.0.0.1:8787/llms.txt
curl -s -o /dev/null -w '%{http_code}\n' -H 'Host: huvudkontoret.io' http://127.0.0.1:8787/name/magnusrenholm
curl -s -o /dev/null -w '%{http_code}\n' -H 'Host: huvudkontoret.cv' http://127.0.0.1:8787/
```

Expected: `200`, `200`, `404`, `404`. The third is the one that matters — it is what `run_worker_first` buys.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: serve the build through the Worker and retire .assetsignore"
```

---

### Task 6: Wire up hk and CI, and write down what changed

**Files:**
- Modify: `hk.json`, `.github/workflows/pr.yml`, `CONTEXT.md`
- Create: `docs/adr/0002-one-worker-many-domains.md`

**Interfaces:**
- Consumes: everything above.
- Produces: nothing further tasks rely on. This is the last task.

- [ ] **Step 1: Split the gate into source and output in `hk.json`**

The content checks need no build and stay fast enough for a pre-commit hook. The output check needs `dist/`. `hk verify web` runs both:

```json
{
  "own": [".gitignore"],
  "commands": {
    "dev": "astro dev",
    "build": "astro build",
    "test": "node --test tools/check/test.mjs src/lib/tld.test.mjs worker/index.test.mjs && node tools/check/run.mjs && npm run build && node tools/check/run.mjs --output",
    "lint": "node tools/check/run.mjs --format"
  }
}
```

- [ ] **Step 2: Give CI the build it now needs**

Replace the steps in `.github/workflows/pr.yml` below `setup-node`:

```yaml
      - uses: actions/setup-node@v4
        with:
          node-version: "24"
          cache: npm

      - name: Install
        run: npm ci

      # The gate before what the gate checks: if these fail, the findings
      # below cannot be trusted either way.
      - name: Self-tests
        run: node --test tools/check/test.mjs src/lib/tld.test.mjs worker/index.test.mjs

      - name: Content
        run: node tools/check/run.mjs

      - name: Build
        run: npm run build

      - name: Output
        run: node tools/check/run.mjs --output

      - name: Formatting
        run: node tools/check/run.mjs --format
```

Also update the header comment: the site now has a build step and this workflow does give it one — the previous comment says the opposite and would be a lie.

- [ ] **Step 3: Commit the lockfile**

`npm ci` needs it, and it is the first lockfile this repo has had.

```bash
git add package-lock.json
```

- [ ] **Step 4: Write ADR 0002**

Create `docs/adr/0002-one-worker-many-domains.md` recording, in the shape of ADR 0001 — Context, Decision, Consequences:

- **Context:** ten registered domains, one served; the perspective runtime built on an unmerged branch and deployed nowhere; nothing in the tree naming which domains exist.
- **Decision:** one build, one Worker, `Host` mapped onto a subtree of `dist/`, with `src/lib/tld.ts` as the single source of truth. Cross-tree requests 404. Rejected: a monorepo of per-domain sites (ten builds, ten previews, and it encodes the opposite of `render(node, perspective)`), and zone-level URL rewrites (no code, but the configuration would live in the dashboard — invisible to the gate, unreviewable in a pull request, and absent from `workers.dev`, so previews would behave differently from production).
- **Consequences:** `run_worker_first` is load-bearing, and every request now costs a Worker invocation. Preview URLs are a single host and cannot exercise Host mapping, so `worker/index.test.mjs` is the guarantee — this is the second acknowledged preview limit after typography in ADR 0001. Publishing flips from opt-out to opt-in and `.assetsignore` is gone. The licensed-font rule moved to `dist/` and must be in place before `io-profile` merges, because that branch is what brings `assets/fonts/*.woff2` into the tree. Adding a domain is now a row in the registry, a route, and a nameserver delegation to Cloudflare — the delegation is the slow part.

- [ ] **Step 5: Rewrite `CONTEXT.md`**

The current file describes a repo where the deploy is the repo root, Pages serves the apex and the runtime is an unmerged experiment. After this step none of that is true. Update: the domain-language table gains `registry`, `tree` and `shared path`; the "Rules that hold everywhere" section replaces "the deploy is the repo root" with "the deploy is `dist/`, and `public/` is `.io` frozen"; the pointers section names `src/lib/tld.ts`, `worker/index.ts` and the two ADRs.

Add the rule that keeps `public/` a stepping stone rather than a dead end:

> **No new design work in `public/index.html`.** It is frozen. Anything new goes through the token and chrome layer from the start — otherwise moving `.io` into `src/` later becomes a redesign instead of a move.

- [ ] **Step 6: Run the full gate one last time**

Run: `hk verify web`
Expected: a green verdict, exit 0.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "docs: record the one-Worker-many-domains decision and rewire the gate"
```

---

## Acceptance

The step is done when all of these hold:

1. `hk verify web` exits 0.
2. `diff -r /tmp/io-before dist` reports no differences other than the removed `demo-hero.html`.
3. `wrangler dev` answers `200` for `huvudkontoret.io/`, `200` for `/llms.txt`, `404` for `/name/magnusrenholm`, and `404` for a `huvudkontoret.cv` Host.
4. No new domain is routed, and `src/lib/tld.ts` lists exactly one `live` entry.
5. `.assetsignore` is gone and no licensed font appears in `dist/`.

## Not done here

- **No perspective is built.** `.name` is step 2: nameserver delegation, a route, the generated agent surfaces, and the page carried over from `identity-runtime`.
- **No agent surfaces are generated.** `.io` keeps its hand-written set; the per-perspective generators arrive with the first perspective.
- **`sharedFacts` still asserts one domain.** The spec has it asserted per domain against that domain's own surfaces; with exactly one live domain that is what it already does, so the check is left alone until there is a second set of surfaces to disagree with.
- **`identity-runtime` is not reconciled.** It carries its own ESLint, Prettier and Tailwind configuration, and this plan brings none of it across — `package.json` here has Astro and nothing else. Step 2 decides what comes along.
- **The chrome extraction is untouched**, deliberately. Lifting shared chrome out of `.io`'s 920-line inline stylesheet is the expensive part and needs its own decision.
