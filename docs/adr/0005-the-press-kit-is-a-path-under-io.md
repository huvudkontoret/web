# 0005 — The press kit is a path under .io, mirrored from the profile

Status: accepted · 2026-09-04

## Context

Sharpest asked for `brandbook.huvudkontoret.io` on 2026-09-02, proposing a
hosted site builder. The address doctrine answered on 2026-09-03 in the design
project (*Brandbook och portal*, 1a): the profile has no audience of its own,
it has `.io`'s audience, so it is content inside the lens and therefore a
path. The word is *profil*, not *brandbook*, because paths speak the house's
language. The page is a press kit, not the whole profile: press, customers,
partners, agencies and printers come for the company and then need the mark
right. The brand platform (Del 1) stays inside.

The design project also holds `filpaket/`, the external file package (v0.2,
2026-08-26): the sigil as SVG, the six marks as PNG in two colour modes and
three scales, the four squares with their own ground, and the colours as CSS
and JSON. Its README carries the rules and the date.

ADR 0002 already says the profile lives outside this repo and arrives as a
diff someone typed. The 2026-09-03 decision adds the rule for published
surfaces: *canon lies in the archive; every published surface is a mirror,
with a date and a line saying where the original is.*

## Decision

- **`profil.html` at the repo root is the page**, served at
  `huvudkontoret.io/profil` by the Worker's default `html_handling`
  (`auto-trailing-slash`). No directory, no trailing slash, no version.
- **It is a mirror.** The rules and the marks on it are a selection from the
  design project's canon (*Grafisk profil* § 07 to § 10, *Wordmark* § 6,
  *Filpaket - extern*), translated by hand like the `:root` block in ADR 0002.
  The page states the date it was mirrored and that the original lies in the
  archive. When the mark changes, the original changes first.
- **The file package is a download on the path, without a version in the
  name**: `assets/profil/huvudkontoret-profil.zip`. The profile has one valid
  state, and old states are wrong rather than older, so the zip is swapped in
  place and the README inside carries the date. The loose files the page
  shows (`assets/profil/`) are the same bytes as the zip's.
- **The marks on the page are files, not set text.** The wordmark is the
  package's PNG, the sigil the package's SVG. Body text falls back to the
  system monospace stack until the MonoLisa webfont is served, exactly as
  `index.html` does; the marks are unaffected because they are images.
- **The door is in the footer.** One line among the links on the homepage.
  The profile is something you fetch, not something you are shown.
- **The gate knows the page.** `pages` in `facts.json` lists every
  hand-written HTML page; `references` and `markup` read each of them, and
  `toRepoPath`/`pagePath` in `lib/site.mjs` hold the Worker's
  extension-dropping rule so `/profil` and `profil.html` are one page to the
  sitemap check.
- **Owner.** The profile has its own owner node, *profilägare*, by exception
  from the inheritance rule: the mark is the group's, not the lens's. The node
  is written as a role; the name stands in the register.

## Consequences

- A change to the mark is three steps: the design project, then the package
  (regenerated there and re-exported), then this page. Nothing here generates
  anything, and nothing here may be edited first.
- The package's binaries cannot be pulled from the design project by an
  agent: the design-sync tool serves them base64-encoded through the model,
  which is neither exact nor cheap at 48 files. They are exported from the
  design project by a person and committed here. The text files (SVG, CSS,
  JSON, README) can go either way.
- Every PNG and the zip live under `assets/`, which the formatting check
  already exempts and the font check does not match. `licensedFontPattern`
  keeps covering `assets/`: the package contains no font, by design.
- The `io-profile` chain (PR #2 and what is stacked on it) rebuilds
  `index.html` and its footer. When it lands, the door has to be carried into
  the new footer, and `facts.json`, `llms.txt` and `sitemap.xml` merge.
  `profil.html` itself is built on the same locked profile and needs nothing
  from that chain.
