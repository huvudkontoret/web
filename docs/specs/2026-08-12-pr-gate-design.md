# PR gate for the static site

Status: implemented · 2026-08-12

## Why

The deploy is the repo root and a push to `main` is a publish. GitHub Pages
serves `main:/` behind the `huvudkontoret.io` CNAME with `build_type: legacy` —
no build, no staging, nothing between the merge button and the live site. Until
now nothing checked anything: `hk verify web` answered *"project 'web' (other)
has no verifiable commands"*, and the repo had no CI at all.

So the pull request is the only place a mistake can still be caught, and this
is what catches it.

## Scope

The static site only — `index.html` and the machine-readable surfaces beside
it. The Astro identity runtime under `src/` on the `identity-runtime` branch is
deliberately out of scope: it is not deployed, it is still in the experiment
and decision phase, and gating it would freeze a thing that is meant to move.

## Design

One dependency-free Node script in the repo, declared once in `hk.json`, run in
two places:

| Where | Command |
|---|---|
| Locally | `hk verify web` → `test` then `lint` |
| CI | `.github/workflows/pr.yml`, the same two commands |

Declaring the commands in `hk.json` is the point rather than a convenience: it
is what makes a green tick in CI mean the same thing a developer saw before
pushing, and it is what makes `hk verify web` stop lying about this project.
The site has no build step, and the gate does not give it one — no
dependencies, no install, no lockfile. A run takes about a second.

```
tools/check/run.mjs          runner, reporting, GitHub annotations
tools/check/checks/*.mjs     one file per check family
tools/check/lib/             site access (git-tracked files) and HTML reading
tools/check/facts.json       what is asserted, as data
tools/check/test.mjs         the gate's own tests
```

### The checks

- **publishing** — the repo root is safe to serve: `CNAME` is the expected
  host, `.nojekyll` is present so Jekyll does not silently drop `.well-known/`,
  robots keeps its `Content-Signal` and `Sitemap` lines, no build output is
  committed.
- **references** — every local link, asset and anchor in `index.html` resolves,
  and every sitemap `<loc>` points at something real.
- **markup** — `index.html` is structurally sound: balanced structural tags,
  one non-empty `<title>`, `lang` set, unique ids, `alt` on images, a doctype.
- **surfaces** — `index.html`, `index.md` and `llms.txt` agree on the declared
  facts, and an address that is announced but not running is never presented as
  live.
- **fonts** — no licensed font file is committed, and the ignore rule that
  keeps it that way is intact.
- **formatting** — `.editorconfig` is respected in hand-written files.

## Decisions

**Tracked, not present.** `references` asks git what exists, not the
filesystem. A reference that resolves only on the author's machine is exactly
the failure that reaches production, and checking the disk would hide it.

**The font rule has two halves.** MonoLisa is purchased and this repo is
public, so the web files are generated locally and stay out of git until the
web licence is confirmed. `references` therefore exempts
`assets/fonts/*.woff2` from having to exist, and `fonts` fails if one is ever
committed. The mistake is one-way: once a font has been served from
huvudkontoret.io, deleting the file later does not undo it.

**Drift is conditional.** A fact stated on one surface must be stated on all of
them; a fact stated nowhere is an editorial choice, not drift. Likewise the
address-system rule only applies to a surface that describes the address
system. Without this, adding the gate would have required rewriting pages that
were never wrong.

**`.editorconfig`, not a formatter.** The formatting check enforces what
`.editorconfig` declares — UTF-8, LF, final newline, no trailing whitespace,
spaces — and reflows nothing. `index.html` is hand-written and
design-sensitive; a formatter's opinion about line breaks is not a defect, and
rewriting the page would be a change to the product rather than a gate on it.
`.prettierrc` existed for the Astro runtime and the `io-profile` branch removes
it, so it was never the static site's contract anyway.

**`assets/` is exempt from formatting.** It holds exported and vendored
artifacts — logos out of a drawing program, Lottie JSON, a minified library.
Holding them to an editing convention would only mean that re-exporting the
logo breaks the build.

**The gate is tested.** Every check has a case proving it fires on a real
defect and, where it matters, a case proving it stays quiet: the licensed-font
exception, a fact absent everywhere, HTML's optional end tags, exported assets.
A gate nobody has tried to break is just a green tick, and the first false
failure is what gets a gate switched off.

## What this found

`llms.txt` on `main` had no team section at all, while `index.html` and
`index.md` both named all three founders. That is the exact failure the surface
check exists for — CONTEXT.md calls a stale `llms.txt` *"a wrong answer given
confidently by somebody else's agent"*. Fixed in the same change by copying the
block already published in `index.md`; nothing new is asserted.

## Not done

- The Astro identity runtime is ungated, by the scope decision above.
- No ADR is recorded yet. This repo still has no `docs/adr/`, and the choice to
  put the workspace's first CI here is decision-shaped enough to deserve one.
- Branch protection is not configured. The gate reports, but nothing yet
  requires it to be green before merge — that is a repository setting, not a
  file in this tree.
