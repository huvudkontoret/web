# 0004 — One repo for the eight addresses

Status: proposed · 2026-08-24

> **Numbering.** `0002` is taken twice: `0002-the-graphic-profile-lives-outside-this-repo.md`
> on `io-profile` (accepted 2026-08-14) and the routing ADR that
> `docs/plans/2026-08-12-tld-workspace-shell.md` step 6 still calls `0002`.
> The graphic-profile ADR keeps `0002` — it is written and accepted. The routing
> ADR becomes `0003`. This is `0004`. Fix the plan's wording when that branch
> next moves.

## Context

Twenty-four domains are registered. `.io` publishes eight of them as lenses in
its SYSTEMET section — `.ai`, `.dev`, `.app`, `.io`, `.cv`, `.name`, `.xyz`,
`.vote` — each with a POW line and an accent from the graphic profile. The
other sixteen are held names with nothing designed for them.
`src/lib/tld.ts` records all twenty-four and marks which is which.

Exactly one address serves anything, and GitHub Pages serves it rather than
this repo's Worker. So the build architecture is still fully open, and choosing
it now is cheaper than choosing it after five domains are live.

Three things already constrain the choice:

- **ADR 0001** put production on one Cloudflare Worker named `web`, with a
  preview URL per pull request and no long-lived environments.
- **ADR 0002** put the graphic profile outside the repo, translated by hand
  into one `:root` block, and refused a token pipeline or a build step for
  eighteen values that change a few times a year.
- **The workspace convention** is already one git repo per project — `fyr`,
  `hk`, `kl`, `kull`, `roffe`, `web` as siblings under
  `Developer/huvudkontoret/`, with `hk` as the harness. Separate repos are not
  a new idea here. The open question is whether an *address* is the kind of
  thing that gets one.

## Decision

**One repo — `web` — owns all eight addresses. A repo boundary follows a
runtime, not an address.**

The rule, stated so the next domain does not reopen the argument:

> An **address** is a lens: a page rendered from shared data, wearing the shared
> chrome, carrying the profile. It lives in `web`, as a subtree of one build.
>
> A **runtime** has its own state, its own tests and its own release cadence. It
> gets its own repo and its own Worker, and it reaches the estate through DNS
> rather than through the build.

What follows from it:

- `.name` and `.cv` render the same person node. They are two lenses on
  `src/content/nodes/`, and splitting them across repos would mean either
  duplicating a person or publishing them as a package to read one YAML file.
- All eight wear one `:root` block. Eight repos means eight hand-translations
  of a profile that ADR 0002 already accepts translating once.
- kl's sync service is a Durable Object on a `.dev` subdomain. It is a runtime:
  it stays in `kl`, gets its own Worker, and shares only the zone. `web` never
  learns it exists.
- `.xyz` *describes* hk, kl and kull — "vår whiteboard, de bor här tills de
  bär". It does not host them. Product repos stay where they are; `.xyz` links
  to them.

### The shape

```
web/
  public/                   .io verbatim — frozen, byte-exact, never processed
    index.html              the profile's only fully realised expression
    index.md llms.txt llms-full.txt robots.txt sitemap.xml
    .well-known/
    assets/                 shared by every address: logos, fonts, sigills
  src/
    styles/profile.css      the :root block, lifted — the shared contact surface
    styles/chrome.css       top bar, layout primitives, typography base
    lib/tld.ts              the registry: 24 domains, 8 of them lenses
    lib/tokens.ts           POW line and accent per lens, mirroring profile.css
    layouts/Shell.astro     the chrome
    content/nodes/          person nodes — .name and .cv both read these
    pages/<lens>/           one directory per lens tree
  worker/index.ts           Host → tree, 404 across tree boundaries
  tools/check/              the gate
  wrangler.jsonc            every routed domain
```

### `.io` stays in `public/` permanently

The TLD workspace spec left this open, leaning towards lifting chrome *out of*
`.io` rather than converting `.io` to match `Shell.astro`. Settle it in that
direction, and make it permanent rather than a stepping stone:

- `.io` is the only place the profile is fully realised. `Shell.astro` is a
  sketch beside nine hundred lines of hand-written CSS. `.io` moving in is what
  *defines* the chrome layer, not what conforms to it.
- Freezing `.io` keeps the strongest safety property the migration has —
  *publishes byte-identical bytes before and after* — permanently, instead of
  spending it once and losing it.
- ADR 0002 already treats `index.html` as the thing the profile lands in by
  hand. Feeding it through Astro would put the profile's authority inside the
  build, which is where ADR 0002 says it does not belong.

The cost is real: `.io`'s `:root` block and the shared `profile.css` are the
same eighteen values written twice, and visual drift between them is invisible.

**Pay it with a check, not a build step.** The gate asserts that the custom
properties declared in `public/index.html`'s `:root` block and in
`src/styles/profile.css` are identical in name and value. That turns ADR 0002's
unenforced convention — *when the two encodings disagree, the CSS is right* —
into something CI fails on, without a token pipeline and without generating one
encoding from the other.

`src/lib/tokens.ts` stays the third encoding and stays derived: it carries the
POW line and the accent *name*, and reads its colour from the custom property.
The version recovered from `bf21a0b^` carries coral and mint hexes that predate
the profile entirely; it is superseded, not a starting point.

## Alternatives rejected

**A repo per domain.** Eight CI setups, eight deploys, eight profile
translations, and the node data published as a package or duplicated — which
inverts the repo's one abstraction from *the node is dumb, the perspective is
smart* into *every perspective carries its own node*. The isolation it buys is
isolation the domains do not want.

**`sites/io/`, `sites/name/`, `sites/cv/` inside one repo.** Cheaper than eight
repos and still wrong: it encodes the domains as separate websites that happen
to share a company, and multiplies the build, the deploy and the preview URL to
buy the same unwanted freedom.

**One Worker per lens, one repo.** This is the serious alternative. It buys
independent deploys and a blast radius of one address instead of eight. Rejected
for now: at one live domain it buys nothing, `wrangler rollback` already covers
the failure it protects against, and it moves routing out of the registry —
which exists precisely so that routing lives in one reviewable place. Revisit
when a lens needs a release cadence of its own; by the rule above, that is what
would make it a runtime.

**Zone-level URL rewrites, no code at all.** Configuration in the Cloudflare
dashboard rather than the repo: invisible to the gate, unreviewable in a pull
request, and absent from `workers.dev`, so every preview would behave
differently from production. ADR 0001 already concluded that a change to a live
domain should be a diff, not a click.

## Consequences

**A new address is a small, bounded change.** A row in `src/lib/tld.ts`, a page
directory, a route in `wrangler.jsonc`, and a nameserver move. The gate asserts
the row and the route arrive together. Nothing else in the repo has to know.

**The blast radius is eight addresses.** One bad deploy takes down every live
lens at once. Accepted, with the preview URL and `wrangler rollback` as the
mitigations, and the note that this is the first thing to re-examine if the
estate ever grows a lens with real traffic.

**The held names need a rule of their own, and it is not a page.** Sixteen
domains resolve to registrar parking today — a page we did not write, carrying
our name. Pointing them at the Worker for a 404, or redirecting them to `.io`,
is a DNS change plus a registry row and needs no build. Decide once, apply to
all sixteen. It is out of scope here, and it gets cheaper the more names it
covers — which is an argument for deciding it before the next purchase, not
after.

**The gate grows a check that reads two files in different languages.** The
`:root` parity check parses CSS custom properties out of an HTML `<style>`
block and out of a stylesheet. `tools/` stays dependency-free, so this is a
regex over declarations, not a CSS parser — good enough for a flat `:root`
block, and it must fail loudly rather than silently pass if it cannot find
either block.

**Nothing here unblocks anything.** Every address still waits on the zone move
to Huvudkontoret's own Cloudflare account. See
`docs/runbooks/2026-08-24-domain-activation.md`.
