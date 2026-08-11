# Fonts

The profile puts MonoLisa on all typography, so `index.html` declares
`@font-face` for seven weights under `assets/fonts/`. The `.woff2` files are
**not committed** — `.gitignore` excludes them.

## Why they are not in the repo

MonoLisa is a purchased typeface, not a redistributable one, and its desktop
licence does not by itself cover serving the font from a website. A push to
`main` publishes this repo, so committing the binaries would publish them
too. The licence terms are at <https://www.monolisa.dev/license>.

Until the web licence is confirmed, the page falls back to the system
monospace stack (`ui-monospace, SFMono-Regular, Menlo, Consolas`). The design
survives that — the profile is monospace-native — but it is not the profile.

## To ship MonoLisa

1. Confirm the web licence covers `huvudkontoret.io`.
2. Drop the `assets/fonts/*.woff2` line from `.gitignore`.
3. Generate the files (below) and commit them.

## Generating the files

Source: `MonoLisa Plus v2.010 2023-08-24`, the same release the design
project uses. `woff2_compress` comes from `brew install woff2`.

```sh
for w in Light LightItalic Regular RegularItalic Medium SemiBold Bold; do
  cp "$HOME/Library/Fonts/MonoLisa-$w.ttf" assets/fonts/
  woff2_compress "assets/fonts/MonoLisa-$w.ttf"
  rm "assets/fonts/MonoLisa-$w.ttf"
done
```

That is roughly 370 kB for the seven weights, unsubset. Subsetting to Latin
plus the grammar glyphs (`▮`, `·`, `°`) would cut it substantially and is
worth doing before this goes live.
