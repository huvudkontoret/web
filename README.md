# web — huvudkontoret.io

The public website of Huvudkontoret, a consultancy in Luleå. It is a
hand-written static page — `index.html` — published together with a set of
machine-readable surfaces so an agent can read the company as easily as a
person can. There is no framework, no build step and no dependencies: the
repo root *is* the site.

The site is in Swedish. Everything written about it — commits, code,
comments, docs, pull requests — is in English.

## The one thing to know

**A push to `main` is a publish.** The apex is served straight from the repo
root with nothing in between, so no build, no bundler and no review
environment stands between a commit and huvudkontoret.io. Nothing downstream
catches a mistake, which makes the pull request the last place anything can
be caught — and `tools/check` is what catches it.

## Run it

```sh
hk dev web       # serve the repo root at http://127.0.0.1:8787
hk verify web    # the gate: self-tests, content checks, formatting
```

Exactly the files that get published, with no build step in between. Without
the workspace harness, the same two commands are:

```sh
python3 -m http.server 8787 --bind 127.0.0.1
node --test tools/check/test.mjs && node tools/check/run.mjs && node tools/check/run.mjs --format
```

Node 22 and `python3` are the whole toolchain. There is no `npm install`, no
lockfile, and the gate has no dependencies — the site has no build step and
the tooling must not give it one.

## What is in here

| Path | What it is |
|---|---|
| `index.html` | The site. Hand-written and design-sensitive; no formatter reflows it |
| `index.md` · `llms.txt` · `llms-full.txt` | Agent surfaces — the same company, written for machines |
| `robots.txt` · `sitemap.xml` · `.well-known/` | Crawl policy, resource list, API catalog and an installable agent skill |
| `assets/` | Images, icons and fonts |
| `.assetsignore` | What the repo root narrows down to before it is served |
| `wrangler.jsonc` | The Cloudflare Worker that will serve the apex |
| `CNAME` · `.nojekyll` | GitHub Pages, which still serves it today |
| `tools/check/` | The gate — see its own README |
| `docs/` | `adr/` decisions · `specs/` designs · `runbooks/` operations |
| `CONTEXT.md` | Domain language and the rules that hold everywhere. Read this one |

## What actually gets published

The asset directory is the repo root, so without a rule the whole checkout is
the website. `.assetsignore` is that rule, and it narrows the site to
`index.html`, `index.md`, `llms.txt`, `llms-full.txt`, `robots.txt`,
`sitemap.xml`, `.well-known/` and `assets/`. The gate asserts that set is
*exactly* what survives, so a new file at the repo root cannot quietly appear
on the site.

Nothing is hidden by this. The repo is public; excluding a file stops it from
being part of the website, not from being read on GitHub.

## Hosting, mid-migration

As of 2026-08-12 the apex still answers `server: GitHub.com`. That is correct,
not a bug. ADR 0001 decided to retire GitHub Pages and serve the site from the
Cloudflare Worker in `wrangler.jsonc`, but `wrangler deploy` creates the
custom domains it finds in that file — writing the apex route into it *is* the
cutover. The route is therefore held back and lands in its own pull request,
together with `expectCustomDomain` in the gate's facts; the gate fails if
either appears without the other.

Every pull request already gets a preview at
`<branch>-web.<subdomain>.workers.dev`, restricted with Cloudflare Access
because previews show unreleased work. They are built from the repo, fonts
included, so a preview renders as designed.

- Decision: `docs/adr/0001-serve-the-site-from-cloudflare-workers.md`
- Cutover, including the rollback:
  `docs/runbooks/2026-08-12-pages-to-workers-cutover.md`

## Working here

- Trunk-based on `main` in the umbrella worktree layout, conventional
  commits, one squash-merged pull request per slice.
- Run the gate before you push. `.github/workflows/pr.yml` runs the same
  commands, declared once in `hk.json`, so a green tick in CI means what you
  saw locally.
- **Agents are a first-class audience.** Anything that changes what
  Huvudkontoret *is* — services, contact, positioning — changes `index.html`,
  `index.md` and `llms.txt` together. A stale `llms.txt` is a wrong answer
  given confidently by someone else's agent.
- MonoLisa is licensed for the web and its two variable files are committed.
  `webFontLicence` in `tools/check/facts.json` is the fact that allows it, and
  the gate holds `assets/fonts/` to exactly the licensed set — an extra font
  binary anywhere under `assets/` is a finding. The publication has no
  rollback; `docs/runbooks/2026-08-26-monolisa-webfont-cutover.md` is how it
  was done.

## Work that lives off `main`

Two things belong to this repo without being on the trunk:

- **`io-profile`** (PR #2) — the page rebuilt on the locked graphic
  profile, with MonoLisa shipped as a webfont.
- **`identity-runtime`** — the Astro MVP of `render(node, perspective)`,
  where `huvudkontoret.<tld>/<slug>` means "render this node through that
  perspective". Still an experiment, deliberately not deployed and not gated.

## Read next

`CONTEXT.md` for the domain language and the rules that hold everywhere,
`tools/check/README.md` for what the gate asserts and why, `AGENTS.md` for
the workspace conventions. `hk context web` prints the project brief.
