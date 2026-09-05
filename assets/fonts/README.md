# Fonts

The profile puts MonoLisa on all typography. `index.html` declares one
`@font-face` rule per file here, each with the `unicode-range` its name
carries, so a browser fetches only the blocks a page actually uses:

```
MonoLisa-Variable-0020-007F.woff2         upright  Basic Latin
MonoLisa-VariableItalic-0020-007F.woff2   italic   Basic Latin
MonoLisa-Variable-0080-00FF.woff2         upright  Latin-1 Supplement
MonoLisa-VariableItalic-0080-00FF.woff2   italic   Latin-1 Supplement
MonoLisa-Variable-0100-017F.woff2         upright  Latin Extended-A
MonoLisa-VariableItalic-0100-017F.woff2   italic   Latin Extended-A
MonoLisa-Variable-2000-206F.woff2         upright  General Punctuation
MonoLisa-VariableItalic-2000-206F.woff2   italic   General Punctuation
MonoLisa-Variable-20A0-20CF.woff2         upright  Currency Symbols
MonoLisa-VariableItalic-20A0-20CF.woff2   italic   Currency Symbols
MonoLisa-Variable-25A0-25FF.woff2         upright  Geometric Shapes
MonoLisa-VariableItalic-25A0-25FF.woff2   italic   Geometric Shapes
```

Every file is variable on the weight axis (declared as 100–900; the files
also carry MonoLisa's grade axis, which the page does not use). Variable
files replace the seven static weights this page used to name (Light,
LightItalic, Regular, RegularItalic, Medium, SemiBold, Bold). The page uses
300–700 today; the variable axis means the profile can reach for another
weight without another download, and a licence is priced per weight, so it
is the cheaper half of the same decision. The split per Unicode block is how
MonoLisa's webfont tool emits its output — one file per block per style —
and the file names carry the block so a rule and its file cannot drift apart
silently. `tools/og-io.html` loads the upright blocks it uses only — the OG
image has no italics.

## Why they are in the repo

MonoLisa is a purchased typeface, not a redistributable one. A push to `main`
publishes this repo, so committing the binaries publishes them too — which is
allowed only because the licence covers the web. The licence terms are at
<https://www.monolisa.dev/license>.

The files here are the whole set the licence covers for this site.
`webFontLicence` in `tools/check/facts.json` is the fact that allows them, and
the gate fails on any font binary under `assets/` that is not one of them.
Should a file go missing, the page falls back to the system monospace stack
(`ui-monospace, SFMono-Regular, Menlo, Consolas`) — the design survives that,
the profile is monospace-native, but it is not the profile, and the gate
catches it before it is published.

## What the licence has to cover

The desktop licence a developer buys to *write code* in MonoLisa does not
cover serving it from a website, and the personal ("Developer") plan is
personal: MonoLisa's own FAQ sends a company or a product to the commercial
("Creator") plan. Two things about this site put it there:

- **Web.** Self-hosting the `.woff2` files from `huvudkontoret.io`.
- **Logotype.** The wordmark in the chrome and the footer is set in MonoLisa,
  and the EULA carves logotypes out into a separate right.

Desktop/print belongs in the same purchase for anything the profile produces
away from the browser. An application licence does not: the app never embeds
the typeface (`kull`, ADR 0008).

**Buy the media set in one order.** MonoLisa confirmed both halves of this by
email on 2026-08-26: the "All media" discount is a one-time discount, so
adding a usage type later "there would be some kind of premium compared to the
bundle", and an existing personal v2 licence does not count towards a Creator
purchase. There is no pay-the-difference upgrade and no credit for what is
already owned — a category left out now is a category bought at a premium
later.

## Generating the files

Creator includes MonoLisa's own customization and webfont tools. **Use them.**
In the customize tool pick the **Webfont** target (not Desktop), the variable
upright and italic, and `woff2`. The download is one file per selected
Unicode block per style, numbered in the order of the `monolisa.css` it ships
with; rename each to the name above for its block and style.

The tool builds the subset the licence does not let us build ourselves. The
EULA forbids modification — you "may not modify, translate, adapt, alter …
add or subtract any glyphs, symbols or accents, or any other derivative
works" — so never subset or rebuild these locally from the desktop `.ttf`.
Renaming a file is not modifying the font. Everything else here is.

### The recipe

The same settings for upright and italic:

| Unicode ranges | Why |
|---|---|
| Basic Latin | everything |
| Latin-1 Supplement | å ä ö é, `°`, `·` |
| Latin Extended-A | names in copy (š, ł, ő …) |
| General Punctuation | `—`, `…`, typographic quotes |
| Currency Symbols | `€` lives here, not in Latin-1 |
| Geometric Shapes | `▮`, the wordmark's cursor |

Every other range off, arrows included: the profile forbids the arrow glyph
in copy and writes `->` as two characters.

**Every OpenType feature off.** The page disables `calt`, `liga` and `dlig`
in CSS and uses none of the others, so the default glyphs are the whole
page. `ss01` (script italic) in particular stays off — the profile is set in
the standard italic.

This is exactly what `index.html` and `tools/og-io.html` use today, plus a
small margin for Swedish copy. A surface that needs more — coding ligatures
or box drawing for a TUI lens, say — is a new build from the tool and a
normal pull request replacing the files; the gate holds the directory to
the names in `licensedWebFonts`, not to their contents.

## How they got here

The three-part gate that kept these files out of production was lifted in one
change, in the order `docs/runbooks/2026-08-26-monolisa-webfont-cutover.md`
sets out. That publication has no rollback: reverting removes the files from
the site going forward, but does not unpublish what was served.
