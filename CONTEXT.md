# web — context

> This repo is huvudkontoret.io, and the two things it holds live on
> different branches. **`main` is the live site**: a hand-written static page
> — `index.html` plus a set of machine-readable surfaces (`index.md`,
> `llms.txt`, `llms-full.txt`, `sitemap.xml`, `.well-known/`) that exist so
> agents can read the company as easily as people can. No build step, no
> dependencies, no `package.json`. **The identity runtime** is an Astro app
> that lives on the `identity-runtime` branch: an MVP of
> `render(node, perspective)`, where the URL `huvudkontoret.<tld>/<slug>`
> means "render this node through that perspective". It was moved off `main`
> in `bf21a0b` and is not deployed — GitHub Pages serves the repo root of
> `main`, not an Astro build. The runtime is v1 of the TLD concept and is
> still in the experiment and decision phase: nothing about it is settled,
> and it is not waiting on a deploy step.

## Domain language

The runtime terms below are the shared vocabulary for the TLD concept. The
files they name are on the `identity-runtime` branch, not on `main`.

| Term | Meaning |
|---|---|
| node | The raw identity data — a person, portable, structured, machine-readable. One YAML file per node in `src/content/nodes/`, validated by an Astro content-collection schema. **A node does not know how it will be rendered** |
| perspective | The lens a node is rendered through. In the URL it is the TLD: `huvudkontoret.name/x` and `huvudkontoret.cv/x` are the same data seen differently. Locally they are the route prefixes `/name/` and `/cv/` |
| slug | The node's id in the URL — the content-collection entry id (`magnusrenholm`) |
| render(node, perspective) | The system's one abstraction. Everything else is arranging what a perspective is allowed to change |
| chrome | The huvudkontoret layer: the constant shell around any rendering — routing, top bar, layout primitives, typography base, system identity. `src/layouts/Shell.astro`. The feeling to aim for is portal / OS / browser chrome: clean, structured, slightly institutional; not corporate, not generic SaaS |
| POW | A perspective's point of view, stated in one line ("Personporträtt / bio / människa" for `.name`). It sits in the token table, not in prose scattered across pages |
| tokens | A perspective's design contract in `src/lib/tokens.ts`: label, role, POW, accent color and the Tailwind classes derived from it. Adding a perspective starts here — `.name` (coral, Identity) and `.cv` (mint, Capability) are implemented; `.dev`, `.ai`, `.club`, `.blog`, `.link` are named but unbuilt |
| agent surface | A file published for machines rather than browsers: `llms.txt` (curated entry point), `index.md` (token-efficient homepage), `sitemap.xml`, `robots.txt`, `.well-known/api-catalog` and `.well-known/agent-skills/` (an installable skill describing how to talk about Huvudkontoret). They are content, maintained by hand, and they drift from the site unless updated with it |
| Content-Signal policy | The published stance the agent surfaces state: content may be used for search and AI input; model training is not granted |
| static site | The deployed artifact: `index.html` and its siblings at the repo root. **Mid-migration as of 2026-08-12**: GitHub Pages still serves the apex from `main` with the `huvudkontoret.io` CNAME, and the decision is to move to the Cloudflare Worker in `wrangler.jsonc` (ADR 0001). Until the cutover runbook has been run, `server: GitHub.com` on the apex is the correct answer, not a bug |
| published set | What `.assetsignore` lets the Worker serve: `index.html`, `index.md`, `llms.txt`, `llms-full.txt`, `robots.txt`, `sitemap.xml`, `.well-known/`, `assets/`. The asset directory is the repo root, so everything else — agent instructions, docs, the gate's own source — is excluded by name. The gate asserts this set exactly |

## Rules that hold everywhere

- **The node is dumb, the perspective is smart.** A perspective may change
  color, emphasis, layout and tone. It may not change the facts, and a node
  must never carry presentation.
- **Agents are a first-class audience.** Anything that changes what
  huvudkontoret *is* — services, contact, positioning — changes `index.html`,
  `index.md`, `llms.txt`, `llms-full.txt` and
  `.well-known/agent-skills/understand-huvudkontoret/SKILL.md` **together**.
  A stale surface is a wrong answer given confidently by someone else's
  agent, and the one most easily forgotten is `llms-full.txt`, because
  nothing links to it.
- **Swedish for content, English for code and artifacts.** The published tone
  is practical, plain, locally grounded — no hype, no invented prices,
  availability, client names or commitments.
- **The deploy is the repo root, and a push to `main` is a publish.** The apex
  rebuilds from `main` on every push, and the repo is public — so committing
  here is publishing, both the served page and the source. The MonoLisa files
  are gitignored, which is why the deployed page falls back to system
  monospace.
- **A pull request can be looked at before it is published.** Every PR gets a
  preview URL from the Worker, restricted with Cloudflare Access. It is built
  from the repo, so it renders with fallback monospace rather than MonoLisa —
  previews settle layout, content and behaviour, never typography.

## Pointers

- The visual profile is not decided in this repo. It is locked in the design
  project *Huvudkontoret brand och grafisk profil* on claude.ai/design, whose
  `CLAUDE.md` is the rule source and whose `Huvudkontoret.io.dc.html` is the
  canonical mockup for this page. Read those before changing type, colour or
  the wordmark — `index.html` follows them, it does not define them.
- MonoLisa carries all typography, but the `.woff2` files are gitignored
  until the web licence is confirmed, so the deployed page falls back to
  system monospace. See `assets/fonts/README.md` — that is the one gate
  between this page and the profile as designed.
- The OG image is generated, never designed: `tools/og-io.html` is the
  template and `assets/og-io.jpg` its current render.
- The identity runtime is not here. It and its original brief (`PROMPT.md`)
  left `main` in `bf21a0b`, and the `identity-runtime` branch that was meant
  to carry them has since been deleted — so history is the only copy. Recover
  what is needed from the commit before the removal, e.g. `git show
  bf21a0b^:src/lib/tokens.ts` for the per-perspective token table.
- Live site: `index.html` · `index.md` · `llms.txt` · `llms-full.txt` ·
  `sitemap.xml` · `robots.txt` · `.well-known/` · `assets/` — domain in
  `CNAME`. GitHub Pages still serves the apex; ADR 0001 decided to move it to
  the Worker, and the runbook below is the step that actually does it.
- Run: `hk dev web` serves the repo root at <http://127.0.0.1:8787> — exactly
  the files that get published, so the site needs no build step.
- Gate: `hk verify web`, or `node tools/check/run.mjs` directly — the same
  commands `.github/workflows/pr.yml` runs on every pull request. What it
  asserts lives in `tools/check/facts.json`; why it asserts it is in
  `tools/check/README.md`.
- Decisions: `docs/adr/0001-serve-the-site-from-cloudflare-workers.md` ·
  designs in docs/specs/ (`2026-08-12-pr-gate-design.md`) · operations in
  docs/runbooks/ (`2026-08-12-pages-to-workers-cutover.md`, which carries the
  rollback).
- Orientation: README.md is the way in — what the repo is, how to run and
  verify it, what gets published, and where the work that is not on `main`
  lives. This file stays the deeper one: domain language and the rules.
- Workspace brief: `hk context web`
