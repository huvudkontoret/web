# web — context

> This repo is huvudkontoret.io. It holds two things at once, and knowing
> which one you are touching is the whole point of this file. **The live
> site** is a hand-written static page — `index.html` plus a set of
> machine-readable surfaces (`index.md`, `llms.txt`, `llms-full.txt`,
> `sitemap.xml`, `.well-known/`) that exist so agents can read the company as
> easily as people can. **The identity runtime** is not in this repo. It was an Astro
> MVP of `render(node, perspective)`, where the URL
> `huvudkontoret.<tld>/<slug>` means "render this node through that
> perspective"; it left `main` in `bf21a0b`, and the `identity-runtime` branch
> meant to carry it has since been deleted, so history is the only copy —
> `git show bf21a0b^:src/lib/tokens.ts` and its neighbours. What `src/` holds
> today is `lib/tld.ts`, the domain registry the Worker and the gate read. The
> runtime is v1 of the TLD concept and is still in the experiment and decision
> phase: nothing about it is settled, and it is not waiting on a deploy step.

## Domain language

The runtime terms below are the shared vocabulary for the TLD concept, and the
`src/` paths in them describe the MVP as it was, not as the repo is. Read them
as definitions; recover the files from `bf21a0b^` if you need the code. The
terms that describe the live site — static site, published set, agent surface
— are current.

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
| static site | The deployed artifact: `index.html` and its siblings at the repo root. Served by the Cloudflare Worker in `wrangler.jsonc`, which owns `huvudkontoret.io` as a custom domain (ADR 0001, cut over 2026-08-26). `server: cloudflare` on the apex is the correct answer; `server: GitHub.com` would mean something has been rolled back |
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
  here is publishing, both the served page and the source. What reaches the
  apex is decided by `.assetsignore` and nothing else — a file added to the
  repo root is served unless it is excluded by name, and the gate asserts that
  set exactly.
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
- MonoLisa carries all typography, as two variable files
  (`MonoLisa-Variable.woff2`, `MonoLisa-VariableItalic.woff2`), and both are
  gitignored until the web licence is confirmed — so the deployed page falls
  back to system monospace. See `assets/fonts/README.md` for what the licence
  has to cover and `docs/runbooks/2026-08-26-monolisa-webfont-cutover.md` for
  the flip. That is the one gate between this page and the profile as
  designed.
- The OG image is generated, never designed: `tools/og-io.html` is the
  template and `assets/og-io.jpg` its current render.
- The identity runtime and its original brief (`PROMPT.md`) are not here. They
  left `main` in `bf21a0b` and the branch meant to carry them was deleted, so
  history is the only copy: `git show bf21a0b^:src/lib/tokens.ts` for the
  per-perspective token table, `bf21a0b^:src/content/nodes/` for the node data
  the `.name` lens is waiting on.
- Code that is here: `src/lib/tld.ts` (the domain registry — every address,
  its role and where its DNS answers) · `worker/index.ts` (routes a host to
  its tree) · `tools/check/` (the gate)
- Live site: `index.html` · `index.md` · `llms.txt` · `llms-full.txt` ·
  `sitemap.xml` · `.well-known/` · `assets/` — served by the Worker, domain
  in `wrangler.jsonc`
- Run: `hk dev web` runs `npx wrangler dev` at <http://127.0.0.1:8787> — the
  same Worker production runs, so `.assetsignore` decides what exists locally
  too and `/CLAUDE.md` answers 404 here exactly as it does on the apex. The
  static site still needs no build step, and there is no `npm run dev` here to
  reach for — the app that had one is gone.
- Gate for the static site: `hk verify web`, or `node tools/check/run.mjs`
  directly — the same commands `.github/workflows/pr.yml` runs on every pull
  request. What it asserts lives in `tools/check/facts.json`; why it asserts it
  is in `tools/check/README.md`.
- Decisions: `docs/adr/0001-serve-the-site-from-cloudflare-workers.md` ·
  designs in docs/specs/ (`2026-08-12-pr-gate-design.md`) · operations in
  docs/runbooks/ (`2026-08-12-pages-to-workers-cutover.md`, which carries the
  rollback).
- Orientation: README.md is the way in — what the repo is, how to run and
  verify it, what gets published, and where the work that is not on `main`
  lives. This file stays the deeper one: domain language and the rules.
- Workspace brief: `hk context web`
