# tools/check — the gate for the static site

The deploy is the repo root and a push to `main` is a publish: the Worker
serves `main:/` at `huvudkontoret.io`, with no build step in between. Nothing downstream catches a mistake, so the pull request is the last
place anything can be caught. This is what catches it.

```
node tools/check/run.mjs            content checks
node tools/check/run.mjs --format   .editorconfig conformance
node tools/check/run.mjs --json     machine-readable
node tools/check/run.mjs --root DIR check another checkout of this repo
node --test tools/check/test.mjs    the gate's own tests
node tools/check/title.mjs "..."   one subject line against conventional commits
```

Exit codes follow hk: `0` ok, `1` findings, `2` usage error.

The same commands run in three places and are declared once, in `hk.json`:
locally as `hk verify web`, and on every pull request from
`.github/workflows/pr.yml`. A green tick in CI therefore means what a developer
saw before pushing.

There are no dependencies. The site has no build step and this must not give it
one.

## The checks

| Check | Holds |
|---|---|
| `publishing` | The repo root is safe to serve: every required surface is present, robots keeps its `Content-Signal` and `Sitemap` lines, and no build output is committed |
| `workers` | The Worker publishes **exactly** the site: `wrangler.jsonc` keeps its custom domain and `preview_urls`, and `.assetsignore` narrows the repo root to the published set — no more, no less, including the paths git never tracks but wrangler uploads anyway |
| `references` | Every local link, asset and anchor in `index.html` resolves to a file **git tracks** |
| `sitemap` | `sitemap.xml` advertises every public page and only pages: each `<loc>` points at something real, each declared page has an entry, and each entry uses the page's canonical URL |
| `markup` | `index.html` is structurally sound: balanced structural tags, one non-empty `<title>`, `lang` set, unique ids, `alt` on images, a doctype |
| `surfaces` | `index.html`, `index.md` and `llms.txt` agree on the declared facts, and an address that is announced but not running is never presented as live |
| `fonts` | No licensed font file is committed, and the ignore rule that keeps it that way is intact |
| `formatting` | `.editorconfig` is respected in hand-written files |
| `title` | The pull request title is a conventional commit subject — run separately, from the workflow, because the title is not in the checkout |

## The title is checked from the workflow, not from `run.mjs`

Everything above reads the checkout. The pull request title does not live
there, so `title.mjs` is its own entry point, taking the subject as an
argument and run by `.github/workflows/pr.yml` inside the same `verify` job
the branch ruleset already requires — which is what makes it binding without
touching the ruleset.

It is the title and not the branch's commits because the repo squash-merges:
the title is what becomes the subject on `main`. The types live in
`facts.json` like every other fact.

## Two decisions worth knowing before you change anything

**Tracked, not present.** `references` asks git what exists, not the
filesystem. A file that resolves only on the author's machine is precisely the
failure this exists to catch, and checking the disk would hide it.

**MonoLisa is referenced but must never be published.** The typeface is
purchased and this repo is public, so the web files are generated locally and
stay out of git until the web licence is confirmed — see
`assets/fonts/README.md`. That makes three parts of one rule: `references`
exempts `assets/fonts/*.woff2` from having to exist, `fonts` fails if one is
ever committed, and `workers` fails if `.assetsignore` stops excluding them
while `.gitignore` still does. The third exists because **wrangler uploads the
working directory, not the git tree** — keeping the fonts out of git does not
keep them off the site, so a local `wrangler deploy` would publish them. The
mistake is one-way; once a font has been served from huvudkontoret.io, deleting
the file later does not undo it.

**The gate refuses to guess at `.assetsignore`.** It reads a deliberately small
subset of gitignore syntax — a plain name, a `dir/`, a `*.ext`. A pattern
outside that subset is a finding rather than a shrug, because the alternative
is treating an unreadable pattern as "matches nothing" and waving through a
file everyone believed was excluded.

## Changing what is asserted

The facts live in `facts.json`, not in code — the shared facts across the agent
surfaces, the addresses not yet in service, the required files, the ignore
patterns. Adding a person or an address is an edit to that file.

Two things the gate deliberately does not do. It does not reflow anything:
`index.html` is hand-written and design-sensitive, and a formatter's opinion
about line breaks is not a defect. And it does not judge tone or wording —
`surfaces` asserts mechanical facts only, so editorial work stays editorial.

If you add a check, add its failing case and its must-not-fire case to
`test.mjs`. A gate nobody has tried to break is just a green tick.
