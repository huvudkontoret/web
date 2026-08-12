# 0001 — Serve the site from Cloudflare Workers

Status: accepted · 2026-08-12

## Context

Two deployment stacks were running against this repo at once, and only one was
intended.

GitHub Pages serves `main:/` behind the `huvudkontoret.io` CNAME with
`build_type: legacy`. That is production, and a push to `main` publishes it.

A Cloudflare Worker named `web` has also been connected to the repo since
2026-05-12 (PR #1, `cloudflare/workers-autoconfig`). Workers Builds runs on
every commit — it reported a `Workers Builds: web` check on PR #4 — but the
Worker serves nothing: `wrangler.jsonc` carried no route, so it only ever
answered on `workers.dev`. CONTEXT.md recorded the symptom without the cause:
"`wrangler.jsonc` is committed but is **not** what serves the apex".

The immediate need was a way to browse the result of a pull request before
merging it. Because a push to `main` publishes, review currently happens either
locally or in production.

## Decision

Serve the site from Cloudflare Workers and retire GitHub Pages, rather than add
previews beside Pages and keep both stacks.

- Production is `main`, served by the `web` Worker on `huvudkontoret.io`.
- Every pull request gets a preview at
  `<branch>-web.<subdomain>.workers.dev`, posted to the PR as a comment by the
  GitHub integration, restricted with Cloudflare Access because the previews
  show unreleased work.
- `www` keeps its 301 to the apex through a zone redirect rule. This Worker has
  no script and cannot redirect on its own.
- No long-lived `dev`/`stage`/`prod` environments. For a hand-written single
  page with no backend, the per-PR preview is the staging environment, and
  three permanent environments would be machinery without a job.

The alternative — preview URLs on the Worker while Pages keeps production — was
rejected. It delivers the same previews for less work, but entrenches the split
that caused the confusion, and it means previews are served by a different
system than the thing they are previewing.

## Consequences

**What the site is becomes an explicit decision.** The asset directory is the
repo root, so without a rule the whole checkout is served. That is already
true: `https://huvudkontoret.io/CLAUDE.md` answers `200 text/markdown` today,
and since PR #4 so do `tools/` and `docs/specs/`. `.assetsignore` narrows
publishing to the site itself — `index.html`, `index.md`, `llms.txt`,
`llms-full.txt`, `robots.txt`, `sitemap.xml`, `.well-known/`, `assets/` — and
the gate asserts that set is exactly what survives, so a new file in the repo
root cannot quietly appear on the site. Nothing is hidden by this; the repo
stays public on GitHub.

**The licensed-font rule needed a second half.** MonoLisa is purchased and the
web licence is unconfirmed, so the `.woff2` files are gitignored. Wrangler
uploads the working directory rather than the git tree, so a local
`wrangler deploy` would publish them regardless — a path the existing check
could not see, because it asks git. `.assetsignore` now excludes them too, and
the gate fails if one rule is present without the other.

**Previews cannot approve typography.** They are built from the repo, so they
render with fallback monospace rather than MonoLisa. Preview URLs can settle
layout, content and behaviour; the typeface stays a local-only judgement until
the web licence is resolved.

**The cutover is a diff, not a click.** `wrangler deploy` creates the custom
domains it finds in `wrangler.jsonc`, so writing the apex route into that file
performs the cutover on the next production build. The route is therefore held
back and lands in its own pull request together with `expectCustomDomain` in
the gate's facts — the gate fails on one without the other. This keeps a change
that moves a live domain from arriving as a side effect of an unrelated commit,
and makes it a thing that can be reviewed and reverted like any other.

**The cutover touches the live apex.** It is sequenced so the Worker is proven
before DNS moves, and `CNAME` and `.nojekyll` stay in the repo until it is
verified — removing them early would strip Pages of its custom domain while it
is still serving. See
`docs/runbooks/2026-08-12-pages-to-workers-cutover.md`, which includes the
rollback.

**Observability changes hands.** Pages build history and its deployment log
stop being the record of what is live; Workers Builds and the Worker's
observability become it.
