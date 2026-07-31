# Two-light sigil — design

- Status: draft
- Date: 2026-07-31

## Context

A design concept where one object casts different shadows depending on which
direction it is lit from. Applied to the Huvudkontoret sigil — the rounded `#`
with a knocked-out `H` — lit from two directions at once, so it casts two
shadows in two colours. Where the shadows cross, the colours mix, and that
overlap is what makes the image read as *lit* rather than as a logo with a
drop shadow.

The requirement is that it can be used on the website. Making it interactive
is a bonus, and this design takes the bonus: one light stays fixed, the other
follows the visitor.

The mark is not the same one currently shipped. `assets/icon_pos.svg` is the
older wordmark-derived icon, which already carries a mint copy offset down-right
— a built-in shadow that would fight the effect. The sigil is a single closed
silhouette in one colour, which is exactly what two coloured shadows need.

## The asset

`assets/sigill.svg` — a single path, `viewBox="0 0 100.08 98.16"`,
`fill-rule="nonzero"` (the `H` counter is a winding-direction knockout, not a
separate subpath).

It was derived from `Huvudkontoret_primär_svart_holistic_RGB.ps`, which despite
the extension is a PDF 1.6 saved by Illustrator. The page content stream was
inflated and its path operators (`m`, `l`, `c`, `re`) translated to SVG path
commands, applying the graphics-state transform stack and flipping the y-axis
into SVG space. No tracing was involved: the curves are the originals.

If a canonical `.svg` later surfaces from the brand kit, it replaces this file
and nothing else changes.

## Design

A standalone `demo-logo.html` in the repo root — self-contained, zero
dependencies, no build step, following the precedent of `demo-hero.html`. It is
a prototype for evaluating the idea, not the shipped hero.

**Rendering.** The sigil is defined once as an SVG `<symbol>` and drawn three
times with `<use>`:

1. Shadow from light A — offset and filled in colour A
2. Shadow from light B — offset and filled in colour B
3. The mark itself — `#171917`, on top, unoffset

Shadow offset is derived from each light's angle and distance: the shadow sits
opposite its light, further away as the light weakens. The two shadow layers
blend where they overlap (`mix-blend-mode`), producing the third colour.

Using the real path rather than a raster mask means the shadows are exact
copies of the form and stay sharp from a 40px nav icon to hero size.

**Colour.** Light A is mint `#3BDDC9`, preserving continuity with the existing
brand shadow. Light B is a control, defaulting to coral `#ff5c7a` — the `.name`
perspective's accent. Note that the perspective tokens live in
`src/lib/tokens.ts` in the `identity-runtime` worktree, not in `main`, where
`src/` is currently staged as deleted; the value is inlined here rather than
imported, since the prototype has no build step and no dependencies.

**Motion.** Light A is fixed — it is what keeps the sigil recognisably itself.
Light B moves:

| Input | Behaviour |
|---|---|
| Pointer | Light B tracks the cursor across the surface |
| Device tilt | Light B follows the phone's orientation |
| Touch drag | Fallback when tilt is unavailable or declined |
| No JS | Static angles; renders as a normal two-shadow mark |
| `prefers-reduced-motion` | Static, no tracking |

iOS only exposes orientation data in a secure context and only after
`DeviceOrientationEvent.requestPermission()` is called from a real user
gesture. The page therefore shows an explicit "Tillåt rörelse" button on first
load on mobile. There is no way around this, and declining must leave a working
page — hence touch drag as the fallback rather than an enhancement.

**Controls.** A panel exposes angle, distance and colour per light, plus the
shadow style: hard offset (flat, closest to the existing brand language), soft
(blurred, physical) and long (extruded). With real path data, long shadows can
be an extruded form rather than a chain of repeated offsets.

## Testing on device

The prototype is served over the LAN from the repo root:

```bash
cd web/main && python3 -m http.server 8000
```

That reaches `http://10.10.10.222:8000/demo-logo.html` from any device on the
home network, and from outside it via UniFi Teleport. Astro's `npm run dev`
does not serve the repo root, so it is not the right server here.

Device tilt needs HTTPS, which the LAN address cannot provide, so mobile
testing goes through a tunnel:

```bash
brew install cloudflared
cloudflared tunnel --url http://localhost:8000
```

The tunnel URL changes on every restart. That is acceptable for a prototype and
is the reason this is a tunnel rather than a deploy: pushing to `main` publishes
to huvudkontoret.io, and iterating on a design should not be a sequence of
publications.

## Success criteria

- The effect holds at 40px (nav icon) and at hero size
- Layout does not shift as the light moves
- The page is useful without JS, without gyro, and under reduced-motion
- A frozen variant can be lifted into `index.html` without rework

## Out of scope

- Changing `index.html`, the nav mark or the footer mark
- Deploying the prototype
- Replacing `assets/icon_pos.svg` anywhere it is currently used
- Deciding which shadow style wins — that is what the prototype is for
