# web — huvudkontoret.io

The public website of Huvudkontoret, a consultancy in Luleå. It is a
hand-written static page — `index.html` — published together with a set of
machine-readable surfaces so an agent can read the company as easily as a
person can. There is no framework, no build step and no dependencies: the
repo root *is* the site.

The site is in Swedish. Everything written about it — commits, code,
comments, docs, pull requests — is in English.

## The one thing to know

**A push to `main` is a publish.** Cloudflare Workers Builds deploys the
Worker from `main` to `huvudkontoret.io` with no site build in between — the
repo root, narrowed by `.assetsignore`, is what goes live. The pull request
is still the last place a mistake can be caught before that happens:
`tools/check` is the gate, and every PR also gets an Access-restricted Worker
preview so you can look before you merge.

## Run it

```sh
hk dev web       # same Worker as production, at http://127.0.0.1:8787
hk verify web    # the gate: self-tests, content checks, formatting
```

`hk dev web` runs `npx wrangler dev`, so `.assetsignore` decides what exists
locally too — `/CLAUDE.md` answers 404 here exactly as it does on the apex.
Without the workspace harness, the same two commands are:

```sh
npx wrangler dev
node --test tools/check/test.mjs src/lib/tld.test.mjs worker/index.test.mjs \
  && node tools/check/run.mjs && node tools/check/run.mjs --format
```

Node 24 is the toolchain for the gate (it imports TypeScript directly). There
is no `npm install`, no lockfile, and the gate has no dependencies — the site
has no build step and the tooling must not give it one. Wrangler is pulled
ephemerally by `npx` for local serve and by Cloudflare Workers Builds for
deploy.

## What is in here

| Path | What it is |
|---|---|
| `index.html` | The site. Hand-written and design-sensitive; no formatter reflows it |
| `profil.html` | The press kit at `/profil`: the marks, the colours and the rules, mirrored from the graphic profile (ADR 0005) |
| `index.md` · `llms.txt` · `llms-full.txt` | Agent surfaces — the same company, written for machines |
| `robots.txt` · `sitemap.xml` · `.well-known/` | Crawl policy, resource list, API catalog and an installable agent skill |
| `assets/` | Images, icons and fonts |
| `.assetsignore` | What the repo root narrows down to before it is served |
| `wrangler.jsonc` · `worker/` | The Cloudflare Worker that serves the apex |
| `tools/check/` | The gate — see its own README |
| `docs/` | `adr/` decisions · `specs/` designs · `runbooks/` operations |
| `CONTEXT.md` | Domain language and the rules that hold everywhere. Read this one |

## What actually gets published

The asset directory is the repo root, so without a rule the whole checkout is
the website. `.assetsignore` is that rule, and it narrows the site to
`index.html`, `profil.html`, `index.md`, `llms.txt`, `llms-full.txt`,
`robots.txt`, `sitemap.xml`, `.well-known/` and `assets/`. The gate asserts that set is
*exactly* what survives, so a new file at the repo root cannot quietly appear
on the site.

Nothing is hidden by this. The repo is public; excluding a file stops it from
being part of the website, not from being read on GitHub.

## Hosting

Production is the Cloudflare Worker named `web` on `huvudkontoret.io`
(ADR 0001). Cut over from GitHub Pages on 2026-08-26; `server: cloudflare` on
the apex is the correct answer. `www` keeps a 301 to the apex through a zone
redirect rule.

Publish path:

1. Open a pull request against `main`.
2. `.github/workflows/pr.yml` runs the gate (self-tests, title, content,
   formatting) — the same commands as `hk verify web`.
3. Cloudflare Workers Builds deploys a preview at
   `<branch>-web.<subdomain>.workers.dev`, restricted with Cloudflare Access
   because previews show unreleased work. Fonts are in the repo, so a preview
   renders as designed.
4. Merge to `main`. Workers Builds deploys production. The custom domain in
   `wrangler.jsonc` is what the Worker serves; GitHub Actions does not deploy.

There is no long-lived `dev` / `stage` environment. The per-PR preview is the
staging environment.

- Decision: `docs/adr/0001-serve-the-site-from-cloudflare-workers.md`
- Cutover record and rollback:
  `docs/runbooks/2026-08-12-pages-to-workers-cutover.md`

A dynamic `pages-build-deployment` workflow may still appear in the Actions
list from the old GitHub Pages connection. Pages itself is off; it is not part
of the publish path. Leave it alone unless someone is explicitly cleaning up
repository settings.

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
- MonoLisa is licensed for the web and its variable files are committed.
  `webFontLicence` in `tools/check/facts.json` is the fact that allows it, and
  the gate holds `assets/fonts/` to exactly the licensed set — an extra font
  binary anywhere under `assets/` is a finding. The publication has no
  rollback; `docs/runbooks/2026-08-26-monolisa-webfont-cutover.md` is how it
  was done.

## Work that is not on `main`

The Astro identity-runtime experiment (`render(node, perspective)`) left
`main` in `bf21a0b` and its branch was deleted — history is the only copy.
See `CONTEXT.md`. Open feature work for other TLDs lives on ordinary PRs
against `main`.

## Read next

`CONTEXT.md` for the domain language and the rules that hold everywhere,
`tools/check/README.md` for what the gate asserts and why, `AGENTS.md` for
the workspace conventions. `hk context web` prints the project brief.
