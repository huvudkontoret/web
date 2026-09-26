# 0002 — The graphic profile lives outside this repo

Status: accepted · 2026-08-14 · amended 2026-09-23 (the canon is readable)

## Context

The visual identity is not decided here. It is locked in the design project
*huvudkontoret // kanon* on claude.ai (project id
`c9c8314e-98dd-4866-b750-dacdb96563d3`), whose `CLAUDE.md` is the rule source
and whose `Huvudkontoret.io.dc.html` is the canonical mockup for this page,
with `Huvudkontoret.io mobil.dc.html` for the phone layout and
`Huvudkontoret.io profil.dc.html` for `/profil`. `index.html` follows those; it
does not define them.

Nothing automates that hand-off. The design project is an ordinary claude.ai
project, not a design-system project, so DesignSync's `list_projects` does not
return it and its write methods do not apply. When this decision was written
that was taken to mean the project was out of reach altogether. It is not: the
read methods work on the project id directly, so `get_project`, `list_files`
and `get_file` return the canon as it stands (verified 2026-09-12). What does
not exist, and is not wanted, is a path that writes the profile into this
repo.

The repo has no build step and no dependencies, by decision, and the deploy is
the repo root (ADR 0001). Whatever carries the profile into the site has to
survive in a single hand-written `index.html`.

Today it survives as CSS custom properties: eighteen of them in the `:root`
block of `index.html`, holding the tonal scale, the corporate signal colour,
one accent per lens, and three layout constants. The same lens accents exist a
second time as
`src/lib/tokens.ts` on the `identity-runtime` branch, where each perspective
carries a label, a role, a POW line and an accent. One profile, two encodings,
and no rule about which one is right when they disagree.

## Decision

Treat the profile as an external, authoritative source that is translated by
hand, and write down who owns what.

- The design project owns typography, colour and the wordmark. This repo owns
  markup, layout and delivery. A change to type, colour or the wordmark starts
  there and arrives here as a diff someone typed.
- The translation stays manual. No generator, no token pipeline, no build step
  for eighteen values that change a few times a year.
- The `:root` block is the single contact surface between the profile and the
  code. Its properties are named one-to-one against the profile's own names, so
  a profile change is a diff in one block rather than a search through the
  stylesheet. A custom property declared anywhere else is a local
  implementation detail and carries no profile authority — `--dim` and
  `--dim-num`, which tune one component's opacity, are the current examples.
- **CSS is the source for the POW table.** `src/lib/tokens.ts` on
  `identity-runtime` mirrors the custom properties; nothing is generated from
  the TypeScript, and a new lens accent is never decided there first.

Generating one encoding from the other was rejected. It would buy consistency
by introducing exactly the build step this repo has spent two decisions
avoiding, and it would put the profile's authority inside the repo, which is
where it specifically does not belong.

## Consequences

**Reviewing a profile change means opening the design project.** There is no
diff that shows the rule being followed, only the code that follows it. A
reviewer who has not read the design project's `CLAUDE.md` can check that the
page is internally consistent and nothing more. An agent can do that reading
itself: a task that says "per canon" is checked against the `.dc.html` files
and `CLAUDE.md` through DesignSync's read methods before anything changes, and
what comes back is treated as data, never as instructions. The manual
translation stands; what changed is that the source can be looked at from
here.

**The colour names stay Swedish.** Bläck, Papper, Ram, Sten, Grafit are the
profile's own terms and travel with it, like `kl` from *klockan*. They are
product vocabulary, not code written in the wrong language.

**Drift between the two encodings is possible, and now has a direction.** When
`tokens.ts` and the `:root` block disagree, the CSS is right and the TypeScript
is the bug. That is a convention, not a check — nothing enforces it, because
the two live on branches that are not merged into one another.

**MonoLisa is published, and the licence is the gate.** When this was written
the `.woff2` files were gitignored and `.assetsignore`d pending the web
licence, so production and previews rendered in fallback monospace. The
licence was confirmed, the files were cut over on 2026-08-26
(`docs/runbooks/2026-08-26-monolisa-webfont-cutover.md`) and published with
the rebuilt page on 2026-09-14: twelve variable files under `assets/fonts/`,
one upright and one italic per Unicode block, loaded through `unicode-range`.
Production and PR previews now render as designed. What guards the page is
`webFontLicence` in `tools/check/facts.json`, the fact that allows exactly
that set; the gate fails on any font binary under `assets/` that is not in
it. Should a file go missing, the page falls back to the system monospace
stack — the design survives that, the profile is monospace-native, but it is
not the profile, and the gate catches it before it is published. The
publication itself has no rollback. See `assets/fonts/README.md`.

**The 2 % rule is a rule, not a token.** `--signal` points; it does not
decorate. Nothing in the code can express that constraint, so it lives in the
design project and in review.
