# Cutover: ship MonoLisa as a webfont

The repo is public and the deploy is the repo root, so this is the one change
in the repo that cannot be undone by reverting it. Once a `.woff2` has been on
`main` it has been served from `huvudkontoret.io` and mirrored by everyone who
forked or cloned; deleting the file later does not retract it. Do not start
this until the licence actually covers the web (`assets/fonts/README.md` says
what it has to cover).

Everything below is one pull request. The gate fails on any half of it.

## Before you start

The rule lives in three checks that only make sense together, and one fact
flips all three:

| Where | While `webFontLicence` is false | Once it is true |
|---|---|---|
| `fonts` | no `.woff2` may be tracked, and both ignore rules must be intact | exactly the licensed files must be tracked, and both ignore rules must be gone |
| `references` | `index.html` may point at fonts git does not carry | the fonts it points at must exist like any other asset |
| `workers` | `.assetsignore` must exclude them, or a local `wrangler deploy` publishes them anyway | it must not exclude them, or the Worker serves a page whose fonts 404 |

## 1. Produce the files

Build them with MonoLisa's own webfont tool — not locally, not subset. See
`assets/fonts/README.md`.

```
assets/fonts/MonoLisa-Variable.woff2
assets/fonts/MonoLisa-VariableItalic.woff2
```

The names are not cosmetic: `licensedWebFonts` in `tools/check/facts.json` is
the list the gate holds the directory to, and anything else in there is a
finding.

## 2. Flip the fact

`tools/check/facts.json`:

```json
"webFontLicence": true
```

Running the gate now should fail loudly, and every finding should be one of
the steps below. That is the check doing its job — work through them.

## 3. Drop both ignore rules, in the same commit

- `.gitignore` — the `assets/fonts/*.woff2` line
- `.assetsignore` — the `assets/fonts/*.woff2` line

Neither on its own. Wrangler uploads the working directory rather than the git
tree, so `.gitignore` alone never governed what production serves.

## 4. Commit the fonts

```sh
git add assets/fonts/MonoLisa-Variable.woff2 assets/fonts/MonoLisa-VariableItalic.woff2
```

## 5. Preload them

Two files are on the critical path for every view of the page, so with the
fonts actually present the `<head>` should ask for them early:

```html
<link rel="preload" href="assets/fonts/MonoLisa-Variable.woff2" as="font" type="font/woff2" crossorigin />
<link rel="preload" href="assets/fonts/MonoLisa-VariableItalic.woff2" as="font" type="font/woff2" crossorigin />
```

`crossorigin` is required even same-origin — a font preload without it is
fetched twice. This step waits until now on purpose: preloading a file that is
not there costs every visitor two failed requests.

## 6. Verify

```sh
hk verify web            # or: node tools/check/run.mjs
node --test tools/check/test.mjs
```

Then open the pull request and look at the preview URL. Until this change,
previews always rendered in fallback monospace because the fonts were not in
the build — the preview rendering *as designed* is the thing this step is
checking.

## 7. Merge

The merge publishes the fonts. There is no step 8 and no rollback.

## Rollback

There is none for the publication itself. If the licence turns out not to
cover this, reverting the commit removes the files from the site going
forward, but it does not unpublish what was served. Treat step 7 as the
irreversible one and do steps 1–6 with that in mind.
