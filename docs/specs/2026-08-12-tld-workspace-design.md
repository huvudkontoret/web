# One repo, ten domains: the TLD workspace

Status: proposed · 2026-08-12

## Why

Ten domains are registered and all ten resolve today. Only `huvudkontoret.io`
is served by anything: the hand-written page at the repo root, still behind
GitHub Pages while the apex route is held back. The other nine are parked at
their registrars.

Meanwhile the idea those domains exist for — `render(node, perspective)`, where
the TLD *is* the perspective — is built for `.name` and `.cv` on the
`identity-runtime` branch and deployed nowhere. The two halves of this repo do
not share a build, a deploy, or a check, and nothing in the tree says which
domains exist or what serves them.

This describes the structure that lets one repo serve all ten, and the order in
which to get there.

## Scope

The repository structure, the routing model, and the gate changes that follow
from them. Not the design of any individual perspective, not the content of any
domain, and not the extraction of shared chrome out of `.io` — that last one is
named here as a later, separate decision precisely because it is the expensive
part.

## The domains

Verified by DNS on 2026-08-12:

| Domain | Nameservers | Status |
|---|---|---|
| `huvudkontoret.io` | Cloudflare | Live — A records point at GitHub Pages |
| `huvudkontoret.cv`, `.vote` | Namecheap | Parked |
| `huvudkontoret.name`, `.dev`, `.ai`, `.club`, `.blog`, `.link`, `.app` | Loopia | Parked |

Nine of the ten therefore need a nameserver delegation to Cloudflare before
they can be a custom domain on the Worker. **Adding a TLD is a DNS move, not
only a diff** — and that is the slow step, so it belongs on the checklist
rather than in a footnote.

## Design

### Not a monorepo of sites

The TLDs are not separate websites that happen to share a company. They are
perspectives on the same data, which is the one abstraction this repo has.
`sites/io/`, `sites/name/`, `sites/cv/` would encode the opposite of that, and
would multiply the build, the deploy and the preview URL by ten to buy a
freedom the domains do not want.

But the model is mixed, not pure. Three kinds:

- **perspective** — `.name`, `.cv`, `.dev`, `.ai`, `.link`: a lens on a shared
  node. `render(node, perspective)`.
- **surface** — `.blog`, `.club`: own content that does not live in a person
  node.
- **static** — `.io`: the company front, hand-written, byte-exact.

### The shape

```
public/                    copied verbatim into dist/ by Astro
  index.html               .io — frozen
  index.md llms.txt llms-full.txt robots.txt sitemap.xml
  .well-known/
  assets/                  shared: logos, fonts, og images
src/
  lib/
    tld.ts                 the registry — routing facts, no Astro, no styling
    tokens.ts              the design contract per perspective
  layouts/Shell.astro      chrome
  content/
    nodes/                 person nodes, shared across perspectives
    posts/                 .blog
  pages/
    name/[slug].astro
    cv/[slug].astro
    [tld]/llms.txt.ts      agent surfaces, generated per perspective
    [tld]/sitemap.xml.ts
    [tld]/robots.txt.ts
worker/
  index.ts                 Host → tree, 404 across tree boundaries
  index.test.ts
tools/check/               the gate, extended
wrangler.jsonc             every live domain
```

### The registry

`src/lib/tld.ts` is what makes this a workspace rather than a directory with
sites in it — one source of truth about the domains:

```ts
export const tlds = {
  io:   { host: 'huvudkontoret.io',   kind: 'static',      tree: '/',      status: 'live' },
  name: { host: 'huvudkontoret.name', kind: 'perspective', tree: '/name/', status: 'planned' },
  cv:   { host: 'huvudkontoret.cv',   kind: 'perspective', tree: '/cv/',   status: 'planned' },
  blog: { host: 'huvudkontoret.blog', kind: 'surface',     tree: '/blog/', status: 'planned' },
  ai:   { host: 'huvudkontoret.ai',   kind: 'perspective', tree: '/ai/',   status: 'not-in-service' },
  // .dev .club .link .app .vote
} as const;
```

`status` means what this Worker does with the domain, not what the registrar
thinks: `live` is routed and served, `planned` is registered and intended but
not yet delegated or routed, `not-in-service` is registered and publicly
declared as not running — which is the state `.ai`, `.app` and `.vote` are
already announced in.

Five consumers read it: the Worker, the Astro routes, the agent-surface
generators, the gate, and the documentation. Adding a TLD becomes one row plus
one route, and the gate asserts the two always travel together — the same
interlock `expectCustomDomain` already is.

`tld.ts` is bundled into the Worker, so it must import neither Astro nor
Tailwind. That constraint is the seam and it is deliberate: **routing facts in
`tld.ts`, presentation in `tokens.ts`.** The Worker never needs to know what
colour `.cv` is.

### The Worker

```ts
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const tld = registry.byHost(url.host);
    if (!tld || tld.status !== 'live') return notFound();
    if (isShared(url.pathname)) return env.ASSETS.fetch(request);
    if (crossesTree(url.pathname, tld)) return notFound();
    url.pathname = tld.tree + url.pathname.slice(1);
    return env.ASSETS.fetch(new Request(url, request));
  },
};
```

`assets.run_worker_first` must be `true`. Workers serve static assets *ahead
of* the script by default, so without it `huvudkontoret.io/name/magnusrenholm`
would be answered straight out of `dist/` and never reach the 404 rule. The
cost is a Worker invocation on every request including images, which at this
traffic is nothing; narrowing it to a pattern list is an optimisation available
later without touching the script.

`worker/index.test.ts` runs under `node --test`, which the gate already uses: a
table of `(host, path) → (status, asset)` covering cross-tree requests, unknown
hosts and domains that are not in service. This is the only logic in the repo
that can make a live domain wrong, so it is the one that gets tests.

### Two holes the strict model opens

**Shared assets.** All ten domains share logos, fonts and the sigill. Under
strict tree mapping `huvudkontoret.name/assets/logo_pos.svg` would be rewritten
to `/name/assets/logo_pos.svg`, which does not exist. The registry therefore
declares a small list of **shared paths** served identically on every host —
`/assets/` — and that list is also the honest place to record which bytes are
the same on all ten domains. Astro's own per-perspective output lands under
`/name/_astro/` and is unaffected.

**Preview URLs.** `<branch>-web.<subdomain>.workers.dev` is a single host and is
not in the registry, so strict mapping would 404 every preview. On
`workers.dev` hosts the Host mapping is skipped and prefix paths are served
directly, exactly as `astro dev` behaves. The cost is that previews do not
exercise Host mapping, which is why the routing test is the real guarantee.
ADR 0001 already accepts that previews cannot approve typography; this is a
second acknowledged limit and belongs in the same ADR.

### Agent surfaces

`robots.txt`, `sitemap.xml` and `llms.txt` are per domain by nature. Serving
`.io`'s `llms.txt` on `huvudkontoret.cv` would be precisely the failure
CONTEXT.md names: *a wrong answer given confidently by somebody else's agent*.

Each live perspective gets its own, generated at build time from the registry
and the node data. `.io` keeps its hand-written set, frozen in `public/`. The
generated half also fixes a standing complaint — CONTEXT.md records that the
agent surfaces "drift from the site unless updated with it", and a generated
surface cannot drift from what generated it.

### The gate

`.assetsignore` disappears, and that is an upgrade rather than a loss. Today
publishing is opt-out: everything in the repo is served unless it is listed
away. With `dist/` it is opt-in by construction — only what sits in `public/`
or is built from `src/` exists there at all.

One rule must survive the move, and it is easy to drop:

> **The licensed-font rule.** MonoLisa's `.woff2` files are gitignored, and
> `.assetsignore` is what stops a local `wrangler deploy` from publishing them
> anyway, because Wrangler uploads the working directory rather than the git
> tree. Astro copies `public/` into `dist/`, so the check must move with it and
> run against `dist/`. ADR 0001 already says it: never one half without the
> other.

New checks, all driven from the registry:

- `status: 'live'` ⇔ a custom-domain route in `wrangler.jsonc`. This subsumes
  `expectCustomDomain`, which is the same interlock written for one domain;
  it goes away once the registry exists
- every live perspective has `robots.txt`, `sitemap.xml` and `llms.txt` in its
  own tree
- `sharedFacts` asserted per domain against that domain's own surfaces, not
  only `.io`'s
- `addressesNotInService` stops being its own list in `facts.json` and is read
  from the registry
- no licensed font present in `dist/`

### Build and hk

The gate checks the repo root today and needs no build. Afterwards it checks
`dist/` and requires one, so it splits in two: source checks (fast, run by
`.githooks` before commit) and output checks (after `astro build`).

```json
{
  "commands": {
    "dev":   "astro dev",
    "build": "astro build",
    "test":  "node --test tools/check/test.mjs worker/index.test.ts && astro build && node tools/check/run.mjs",
    "lint":  "node tools/check/run.mjs --format"
  }
}
```

Locally: `astro dev` for content and design work on prefix paths, `wrangler dev`
when the routing itself needs looking at.

## Decisions

**`.io` moves to `public/` unchanged, not into `src/`.** Its `index.html` is
1792 lines: roughly 920 of inline CSS, 730 of markup across seven sections. The
agent surfaces and `assets/` never move — they are byte-exact published
artifacts, not pages, and belong in `public/` permanently regardless. The markup
is a mechanical move whenever it happens. The inline stylesheet is the actual
work, and it is a merge rather than a move: `.io`'s hand-written CSS and the
runtime's Tailwind are two design systems today.

That merge costs the same whether it happens now or later; the risk does not.
Done now it happens against a page that was just rebuilt and whose typography
still depends on an unresolved MonoLisa web licence. Done later it happens once,
against a stable page, with preview URLs already in place.

There is also a direction question hiding in it. `.io`'s stylesheet is the only
fully realised expression of the graphic profile; `Shell.astro`'s chrome is a
sketch beside it. So the move is probably not "convert `.io` to match Shell" but
"lift chrome out of `.io` and let Shell inherit it" — `.io` moving in is what
*defines* the chrome layer rather than what conforms to it. That is its own
decision and deserves its own ADR.

**The holding pattern needs a rule, not a directory.** While `.io` sits in
`public/`, Astro does not process it: no shared components, no build-time
checks, no Tailwind, and duplication between `.io` and the runtime is invisible
to the build. `public/` only stays a stepping stone if no new design work goes
into that inline style block — anything new goes through the token and chrome
layer from the start. Without that rule the later move becomes a redesign. The
gate's `sharedFacts` check catches factual drift in the meantime; it does not
catch visual drift.

**Strict isolation, not one site with ten entrances.** Cross-tree requests 404.
The alternative — every domain serving the whole tree — makes the same page
answer on several addresses and puts the entire SEO burden on `canonical`, and
it hands every domain `.io`'s view of the world in its `llms.txt`.

**One build and one script, not ten builds.** Zone-level URL rewrites were also
considered and rejected: no code, but the configuration would live in the
Cloudflare dashboard instead of the repo — invisible to the gate, unreviewable
in a pull request, and absent from `workers.dev`, so every preview would behave
differently from production. ADR 0001 already concluded that a change to a live
domain should be a diff, not a click.

## Sequencing

**First, finish the cutover.** PR #6 is merged — the decision, ADR 0001,
`.assetsignore`, the gate and `preview_urls` are all on `main`. What remains is
the route flip: the `routes` entry in `wrangler.jsonc` together with
`expectCustomDomain: true`, which the gate locks to each other. Everything here
assumes the Worker serves the apex, and rebuilding the asset model while Pages
still answers would mean designing against a system that is on its way out.

**`io-profile` (PR #2) is independent.** It touches `index.html` and assets, not
the structure, and can land on either side of this. The MonoLisa licence is its
own question and blocks none of this.

Then, in three changes:

1. **The shell.** `.io` → `public/`, the Astro skeleton, `tld.ts`, the Worker,
   `assets.directory` from `.` to `dist`, `.assetsignore` replaced by gate
   checks. **No new domain.** The acceptance test is hard and simple: `.io`
   publishes a byte-identical surface before and after, and the gate can assert
   exactly that.
2. **The first perspective, `.name`.** Nameserver delegation to Cloudflare, the
   route, the generated agent surfaces, and the `.name` page carried over from
   `identity-runtime`. This is the proof that the whole chain holds, on one
   domain, where rollback is deleting a route.
3. **The rest**, one per pull request. By then it is routine: a row in the
   registry, a route, a DNS move.

Step 1 carries the only real risk, and it is confined to a domain that already
has a rollback runbook.

## Not done

- **The chrome extraction has no plan.** It is named as the expensive part and
  deliberately left out. It needs its own ADR, and it cannot start until `.io`
  stops moving.
- **`.blog` and `.club` are unmodelled.** They are typed as `surface` in the
  registry and nothing more; their content shape is undesigned.
- **`identity-runtime` has to be reconciled.** It is an unmerged branch with its
  own `package.json`, ESLint and Prettier config, none of which the static site
  currently has. Step 1 has to decide what of that comes along.
- **No ADR yet.** The routing model, `run_worker_first`, the preview-URL limit
  and the shared-path list are decision-shaped and belong in `docs/adr/`
  alongside 0001.
