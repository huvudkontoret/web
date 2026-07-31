# Two-Light Sigil Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone prototype page where the Huvudkontoret sigil is lit
from two directions and casts two coloured shadows, with the second light
following the visitor's pointer or their phone's tilt.

**Architecture:** One HTML file (`demo-logo.html`) at the repo root renders the
sigil three times from a single SVG `<symbol>` — two offset shadow layers and
the mark on top. All shadow geometry lives in a separate ES module
(`assets/light-math.mjs`) so it can be unit-tested with `node --test`; the page
imports it directly, with no build step. Static `transform` attributes in the
markup mean the page renders correctly before any JavaScript runs.

**Tech Stack:** Hand-written HTML, CSS and ES modules. No dependencies, no
bundler. Node's built-in test runner (`node --test`, Node v26.5.0) for the
geometry. `python3 -m http.server` for local serving, `cloudflared` for HTTPS on
mobile.

## Global Constraints

- **Zero dependencies.** Nothing may be added to `package.json`. No bundler, no
  framework, no polyfill.
- **No build step.** The page must work when served as static files straight
  from the repo root.
- **Do not modify `index.html`,** the nav mark, the footer mark, or
  `assets/icon_pos.svg`. This prototype is additive.
- **Do not push.** A push to `main` publishes to huvudkontoret.io. Commit
  locally only.
- **Path-scoped commits only.** `web/main` has 24 files under `src/` and
  `public/` staged as deletions from unrelated work. Always commit with explicit
  paths (`git commit <paths> -m ...`), never a bare `git commit -a`, or those
  deletions get swept into your commit.
- **Swedish for content, English for code and artifacts** (repo `CONTEXT.md`).
  Visible UI copy on the page is Swedish; identifiers, comments and commit
  messages are English.
- **Colours:** mark `#171917`, light A mint `#3BDDC9`, light B coral `#ff5c7a`.
- **Sigil geometry:** `assets/sigill.svg`, `viewBox="0 0 100.08 98.16"`, one
  path, `fill-rule="nonzero"`.

## The shadow-colour rule

This trips people up, so it is stated once here and every task assumes it:

A shadow is the absence of *one* light. Inside the shadow cast by light A, light
B is still shining — so that shadow takes **light B's colour**. Only where both
shadows overlap is all light blocked, and that region goes dark.

Therefore:

| Layer | Offset direction | Fill |
|---|---|---|
| Shadow cast by light A | opposite light A | light **B**'s colour |
| Shadow cast by light B | opposite light B | light **A**'s colour |
| The mark | none | `#171917` |

The shadow layers blend with `mix-blend-mode: multiply`, which darkens the
overlap automatically. Getting the fills the other way round produces a flat,
sticker-like result — if the overlap does not go dark, the fills are swapped.

## File Structure

| File | Responsibility |
|---|---|
| `assets/light-math.mjs` | Pure geometry. Converts a light (angle + distance) into a shadow offset, and converts pointer position or device orientation into a light. No DOM access. |
| `test/light-math.test.mjs` | Unit tests for the above, run with `node --test`. |
| `demo-logo.html` | The page: markup, styling, controls, and the DOM/event wiring that feeds `light-math.mjs` and writes the results onto the SVG. |
| `assets/sigill.svg` | The vectorised sigil. Already committed (`c3ed0c0`). Read-only for this plan — the path is copied into the page's `<symbol>`. |

The math is split out because it is the only part that can be silently wrong: an
inverted sign or a mis-mapped tilt axis looks plausible on screen but feels
wrong to use. Everything else is verified by looking at it.

---

### Task 1: Shadow geometry module

**Files:**
- Create: `assets/light-math.mjs`
- Test: `test/light-math.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `shadowOffset(light: {angle: number, distance: number}) -> {x: number, y: number}`
  - `lightFromPointer(pointer: {x, y}, centre: {x, y}, opts: {radius, minDistance, maxDistance}) -> {angle, distance}`
  - `lightFromTilt(orientation: {beta, gamma}, opts: {range, restBeta, minDistance, maxDistance}) -> {angle, distance}`
  - Angles are degrees in screen space: `0` = light to the right, `90` = light
    below, growing clockwise. Distances are SVG viewBox units.

- [ ] **Step 1: Write the failing tests**

Create `test/light-math.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { shadowOffset, lightFromPointer, lightFromTilt } from '../assets/light-math.mjs'

const near = (actual, expected, eps = 1e-6) =>
  assert.ok(Math.abs(actual - expected) < eps, `expected ${expected}, got ${actual}`)

test('a light on the right throws its shadow to the left', () => {
  const { x, y } = shadowOffset({ angle: 0, distance: 10 })
  near(x, -10)
  near(y, 0)
})

test('a light below throws its shadow upwards', () => {
  const { x, y } = shadowOffset({ angle: 90, distance: 10 })
  near(x, 0)
  near(y, -10)
})

test('a light directly overhead throws no sideways shadow', () => {
  const { x, y } = shadowOffset({ angle: -90, distance: 6 })
  near(x, 0)
  near(y, 6)
})

test('distance scales the offset linearly', () => {
  const near10 = shadowOffset({ angle: 33, distance: 10 })
  const near20 = shadowOffset({ angle: 33, distance: 20 })
  near(near20.x, near10.x * 2)
  near(near20.y, near10.y * 2)
})

const POINTER_OPTS = { radius: 200, minDistance: 4, maxDistance: 14 }

test('a pointer to the right of centre puts the light to the right', () => {
  const light = lightFromPointer({ x: 300, y: 100 }, { x: 100, y: 100 }, POINTER_OPTS)
  near(light.angle, 0)
})

test('a pointer below centre puts the light below', () => {
  const light = lightFromPointer({ x: 100, y: 300 }, { x: 100, y: 100 }, POINTER_OPTS)
  near(light.angle, 90)
})

test('a pointer at the centre sits at the minimum distance', () => {
  const light = lightFromPointer({ x: 100, y: 100 }, { x: 100, y: 100 }, POINTER_OPTS)
  near(light.distance, 4)
})

test('a pointer beyond the radius clamps to the maximum distance', () => {
  const light = lightFromPointer({ x: 900, y: 100 }, { x: 100, y: 100 }, POINTER_OPTS)
  near(light.distance, 14)
})

const TILT_OPTS = { range: 30, restBeta: 45, minDistance: 4, maxDistance: 14 }

test('tilting the phone to the right puts the light to the right', () => {
  const light = lightFromTilt({ beta: 45, gamma: 30 }, TILT_OPTS)
  near(light.angle, 0)
  near(light.distance, 14)
})

test('holding the phone at rest leaves the light at the minimum distance', () => {
  const light = lightFromTilt({ beta: 45, gamma: 0 }, TILT_OPTS)
  near(light.distance, 4)
})

test('tilt beyond the usable range clamps rather than wrapping round', () => {
  const light = lightFromTilt({ beta: 45, gamma: 85 }, TILT_OPTS)
  near(light.distance, 14)
  near(light.angle, 0)
})

test('missing orientation values are treated as rest, not as NaN', () => {
  const light = lightFromTilt({ beta: null, gamma: null }, TILT_OPTS)
  assert.ok(Number.isFinite(light.angle))
  assert.ok(Number.isFinite(light.distance))
  near(light.distance, 4)
})
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd web/main && node --test test/
```

Expected: FAIL — `Cannot find module .../assets/light-math.mjs`.

- [ ] **Step 3: Write the module**

Create `assets/light-math.mjs`:

```js
// Geometry for lighting the sigil from two directions.
//
// A light is {angle, distance}. Angles are degrees in screen space: 0 points
// right, 90 points down, growing clockwise — the same convention as
// Math.atan2(dy, dx) on screen coordinates, where y grows downwards.
// Distances are SVG viewBox units.
//
// Nothing here touches the DOM, so it can be tested with `node --test`.

const DEG = 180 / Math.PI

const clamp = (value, low, high) => Math.min(high, Math.max(low, value))

const finite = (value, fallback) => (Number.isFinite(value) ? value : fallback)

/** Where the shadow lands: opposite the light, further out as it weakens. */
export function shadowOffset(light) {
  const radians = light.angle / DEG
  return {
    x: -Math.cos(radians) * light.distance,
    y: -Math.sin(radians) * light.distance,
  }
}

/** Turn the distance from centre into a light distance, clamped at the edge. */
function reachToDistance(reach, opts) {
  return opts.minDistance + (opts.maxDistance - opts.minDistance) * clamp(reach, 0, 1)
}

/** The light sits where the pointer is, relative to the mark's centre. */
export function lightFromPointer(pointer, centre, opts) {
  const dx = pointer.x - centre.x
  const dy = pointer.y - centre.y
  return {
    angle: Math.atan2(dy, dx) * DEG,
    distance: reachToDistance(Math.hypot(dx, dy) / opts.radius, opts),
  }
}

/**
 * The light follows the phone's tilt. `gamma` is the left/right roll and
 * `beta` the front/back pitch, both in degrees; `restBeta` is the pitch at
 * which someone is holding the phone comfortably, which counts as level.
 * Both axes are clamped to `range` so extreme angles saturate instead of
 * wrapping the light round to the other side.
 */
export function lightFromTilt(orientation, opts) {
  const x = clamp(finite(orientation.gamma, 0) / opts.range, -1, 1)
  const y = clamp((finite(orientation.beta, opts.restBeta) - opts.restBeta) / opts.range, -1, 1)
  if (x === 0 && y === 0) return { angle: 0, distance: opts.minDistance }
  return {
    angle: Math.atan2(y, x) * DEG,
    distance: reachToDistance(Math.hypot(x, y), opts),
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd web/main && node --test test/
```

Expected: PASS, 12 tests.

- [ ] **Step 5: Commit**

```bash
cd web/main
git add assets/light-math.mjs test/light-math.test.mjs
git commit assets/light-math.mjs test/light-math.test.mjs -m "feat(demo): add shadow geometry for two-light sigil

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Static two-shadow render

Builds the page with both lights fixed. No JavaScript yet — this is the state
the page must fall back to when scripts are unavailable, so it is worth having
as a standalone deliverable.

**Files:**
- Create: `demo-logo.html`
- Read: `assets/sigill.svg` (copy the `d` attribute)

**Interfaces:**
- Consumes: nothing from Task 1 yet.
- Produces: DOM contract that later tasks depend on —
  - `<symbol id="sigill">` holding the path
  - `<use id="shadow-a">` and `<use id="shadow-b">`, each carrying a
    `transform="translate(x y)"` attribute
  - a `<svg class="mark">` with `viewBox="-20 -20 140.08 138.16"`

- [ ] **Step 1: Extract the path data**

```bash
cd web/main && python3 -c "
import re, pathlib
print(re.search(r'd=\"([^\"]+)\"', pathlib.Path('assets/sigill.svg').read_text()).group(1))
"
```

This prints one 2608-character `d` string. Copy it verbatim into the `<symbol>`
in the next step — do not retype, reformat or round it.

- [ ] **Step 2: Write the page**

Create `demo-logo.html`. Replace `PASTE_PATH_DATA_HERE` with the string from
Step 1:

```html
<!doctype html>
<html lang="sv">
    <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Sigill — två ljuskällor</title>
        <style>
            :root {
                --paper: #f4f2ee;
                --ink: #171917;
                --light-a: #3bddc9;
                --light-b: #ff5c7a;
            }

            * {
                box-sizing: border-box;
            }

            body {
                margin: 0;
                min-height: 100svh;
                display: grid;
                place-items: center;
                background: var(--paper);
                font:
                    400 15px/1.5 ui-sans-serif,
                    system-ui,
                    sans-serif;
                color: var(--ink);
                overflow: hidden;
            }

            .stage {
                margin: 0;
                width: min(70vmin, 460px);
                touch-action: none;
            }

            .mark {
                display: block;
                width: 100%;
                height: auto;
                overflow: visible;
            }

            .shadows {
                mix-blend-mode: multiply;
            }
        </style>
    </head>
    <body>
        <figure class="stage">
            <svg
                class="mark"
                viewBox="-20 -20 140.08 138.16"
                role="img"
                aria-label="Huvudkontorets sigill, belyst från två håll"
            >
                <defs>
                    <symbol id="sigill" viewBox="0 0 100.08 98.16">
                        <path d="PASTE_PATH_DATA_HERE" fill-rule="nonzero" />
                    </symbol>
                </defs>

                <!--
                  A shadow is the absence of one light, so the shadow cast by
                  light A is still lit by light B and takes B's colour.
                  Swapping these fills is the classic mistake: the overlap
                  stops going dark and the whole thing reads as a sticker.
                -->
                <g class="shadows">
                    <use
                        id="shadow-a"
                        href="#sigill"
                        width="100.08"
                        height="98.16"
                        fill="var(--light-b)"
                        transform="translate(-8 -6)"
                    />
                    <use
                        id="shadow-b"
                        href="#sigill"
                        width="100.08"
                        height="98.16"
                        fill="var(--light-a)"
                        transform="translate(8 6)"
                    />
                </g>

                <use
                    href="#sigill"
                    width="100.08"
                    height="98.16"
                    fill="var(--ink)"
                />
            </svg>
        </figure>
    </body>
</html>
```

- [ ] **Step 3: Serve it and look at it**

```bash
cd web/main && python3 -m http.server 8000
```

Open `http://localhost:8000/demo-logo.html`.

Expected: the black sigil with a coral shadow up-left and a mint shadow
down-right. Where the two shadows overlap behind the mark the colour goes
distinctly darker than either shadow alone. Nothing is clipped at the edges of
the SVG.

If the overlap is *lighter* than the shadows, `mix-blend-mode: multiply` is not
applying — check that `.shadows` wraps both `<use>` elements.

- [ ] **Step 4: Check it from the phone**

With the server still running, open `http://10.10.10.222:8000/demo-logo.html`
on a phone on the same network.

Expected: same image, scaled to the viewport, no horizontal scrolling.

- [ ] **Step 5: Commit**

```bash
cd web/main
git add demo-logo.html
git commit demo-logo.html -m "feat(demo): render the sigil under two fixed lights

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Pointer-driven second light

Light A stays fixed — that is what keeps the sigil recognisably itself. Light B
follows the cursor.

**Files:**
- Modify: `demo-logo.html` (add a `<script type="module">` before `</body>`)

**Interfaces:**
- Consumes: `shadowOffset`, `lightFromPointer` from `assets/light-math.mjs`;
  the `#shadow-a` / `#shadow-b` DOM contract from Task 2.
- Produces:
  - `const lights = { a: {angle, distance}, b: {angle, distance} }` — module-scoped state later tasks read and write
  - `render()` — writes both shadow transforms from `lights`
  - `MOTION_OK` — boolean, false under `prefers-reduced-motion`

- [ ] **Step 1: Add the script**

Insert immediately before `</body>` in `demo-logo.html`:

```html
<script type="module">
    import { shadowOffset, lightFromPointer } from './assets/light-math.mjs'

    const POINTER_OPTS = { radius: 320, minDistance: 4, maxDistance: 14 }

    const mark = document.querySelector('.mark')
    const shadowA = document.querySelector('#shadow-a')
    const shadowB = document.querySelector('#shadow-b')

    // Light A is fixed; light B is the one that moves.
    const lights = {
        a: { angle: 35, distance: 10 },
        b: { angle: -145, distance: 10 },
    }

    const MOTION_OK = !window.matchMedia('(prefers-reduced-motion: reduce)').matches

    function render() {
        // The shadow cast by A is offset opposite A but wears B's colour;
        // the fills are set in the markup and never change here.
        const a = shadowOffset(lights.a)
        const b = shadowOffset(lights.b)
        shadowA.setAttribute('transform', `translate(${a.x.toFixed(2)} ${a.y.toFixed(2)})`)
        shadowB.setAttribute('transform', `translate(${b.x.toFixed(2)} ${b.y.toFixed(2)})`)
    }

    function centreOfMark() {
        const box = mark.getBoundingClientRect()
        return { x: box.left + box.width / 2, y: box.top + box.height / 2 }
    }

    if (MOTION_OK) {
        window.addEventListener('pointermove', (event) => {
            lights.b = lightFromPointer(
                { x: event.clientX, y: event.clientY },
                centreOfMark(),
                POINTER_OPTS,
            )
            render()
        })
    }

    render()
</script>
```

- [ ] **Step 2: Verify the pointer moves the right shadow**

Reload `http://localhost:8000/demo-logo.html` and move the cursor in a slow
circle around the mark.

Expected: the mint shadow (cast by light B) swings around the sigil, staying
opposite the cursor. The coral shadow does not move. The overlap zone slides
along with it and stays darkest where the two cross.

If *both* shadows move, the handler is writing `lights.a` as well — it should
only assign `lights.b`.

- [ ] **Step 3: Verify the reduced-motion and no-JS fallbacks**

In Safari: Develop → Experimental → check nothing; instead use macOS System
Settings → Accessibility → Display → Reduce motion, then reload.

Expected: shadows sit at their static angles and ignore the cursor entirely.

Then disable JavaScript in the browser and reload.

Expected: the page still renders both shadows, from the `transform` attributes
in the markup.

- [ ] **Step 4: Re-run the geometry tests**

```bash
cd web/main && node --test test/
```

Expected: PASS, 12 tests. (The module is unchanged; this guards against an
accidental edit while wiring it up.)

- [ ] **Step 5: Commit**

```bash
cd web/main
git add demo-logo.html
git commit demo-logo.html -m "feat(demo): let the pointer steer the second light

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Control panel

Angle, distance and colour per light, so the design can be judged rather than
guessed at.

**Files:**
- Modify: `demo-logo.html`

**Interfaces:**
- Consumes: `lights`, `render()`, `MOTION_OK` from Task 3.
- Produces: `applyColour(which, hex)` — sets the CSS custom property for a
  light's colour; a `.panel` element that Task 5 extends with a style selector.

- [ ] **Step 1: Add the panel markup**

Insert after the `</figure>` in `demo-logo.html`:

```html
<form class="panel" aria-label="Ljusinställningar">
    <fieldset>
        <legend>Ljus A — fast</legend>
        <label>Vinkel <input type="range" id="a-angle" min="-180" max="180" value="35" /></label>
        <label>Avstånd <input type="range" id="a-distance" min="0" max="20" step="0.5" value="10" /></label>
        <label>Färg <input type="color" id="a-colour" value="#3bddc9" /></label>
    </fieldset>
    <fieldset>
        <legend>Ljus B — rörligt</legend>
        <label>Vinkel <input type="range" id="b-angle" min="-180" max="180" value="-145" /></label>
        <label>Avstånd <input type="range" id="b-distance" min="0" max="20" step="0.5" value="10" /></label>
        <label>Färg <input type="color" id="b-colour" value="#ff5c7a" /></label>
    </fieldset>
</form>
```

- [ ] **Step 2: Add the panel styling**

Add inside the existing `<style>` block:

```css
body {
    place-items: start center;
    padding: 4vmin;
    gap: 3vmin;
    grid-template-rows: 1fr auto;
    overflow: auto;
}

.panel {
    display: flex;
    flex-wrap: wrap;
    gap: 1.5rem;
    justify-content: center;
    width: 100%;
    max-width: 40rem;
}

.panel fieldset {
    flex: 1 1 15rem;
    border: 1px solid color-mix(in srgb, var(--ink) 20%, transparent);
    border-radius: 0.5rem;
    padding: 0.75rem 1rem 1rem;
    margin: 0;
}

.panel legend {
    padding: 0 0.4rem;
    font-size: 0.8rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
}

.panel label {
    display: grid;
    grid-template-columns: 4.5rem 1fr;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.5rem;
    font-size: 0.85rem;
}

.panel input {
    width: 100%;
}
```

- [ ] **Step 3: Wire the controls**

Add inside the existing `<script type="module">`, after `render()` is defined
and before the final `render()` call:

```js
const root = document.documentElement

// The shadow cast by light A wears light B's colour, so a colour picker
// labelled "A" writes the --light-a property that #shadow-b renders with.
function applyColour(which, hex) {
    root.style.setProperty(`--light-${which}`, hex)
}

for (const which of ['a', 'b']) {
    const angle = document.querySelector(`#${which}-angle`)
    const distance = document.querySelector(`#${which}-distance`)
    const colour = document.querySelector(`#${which}-colour`)

    angle.addEventListener('input', () => {
        lights[which].angle = Number(angle.value)
        render()
    })
    distance.addEventListener('input', () => {
        lights[which].distance = Number(distance.value)
        render()
    })
    colour.addEventListener('input', () => applyColour(which, colour.value))
}
```

- [ ] **Step 4: Verify the controls**

Reload and drag each slider.

Expected, and read this carefully before "fixing" anything:

- Light A's **angle and distance** sliders move the coral shadow (`#shadow-a`,
  the one A casts). Light B's move the mint one.
- Light A's **colour** picker changes the **mint** shadow, not the coral one —
  and that is correct. It sets light A's colour, and light A's colour is what
  shines inside the shadow that light B casts. The colour controls therefore
  appear to cross over relative to the sliders sitting beside them. This is the
  shadow-colour rule at the top of this plan doing its job; do not "correct" it.
- Moving the pointer still overrides light B's angle and distance. That is
  intended: the sliders set a starting point and the pointer takes over.

- [ ] **Step 5: Commit**

```bash
cd web/main
git add demo-logo.html
git commit demo-logo.html -m "feat(demo): add per-light angle, distance and colour controls

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Soft and long shadow styles

**Files:**
- Modify: `demo-logo.html`

**Interfaces:**
- Consumes: the `.panel` element and `render()` from Tasks 3–4.
- Produces: `data-style` attribute on `<body>`, one of `hard`, `soft`, `long`;
  `LONG_STEPS` constant; `renderLong()` which populates the extruded layers.

- [ ] **Step 1: Add the style selector markup**

Insert as the first child of the `<form class="panel">`:

```html
<fieldset>
    <legend>Skuggtyp</legend>
    <label><input type="radio" name="style" value="hard" checked /> Hård</label>
    <label><input type="radio" name="style" value="soft" /> Mjuk</label>
    <label><input type="radio" name="style" value="long" /> Lång</label>
</fieldset>
```

- [ ] **Step 2: Add the blur filter and style rules**

Add inside the `<defs>` in the SVG, after the `<symbol>`:

```html
<filter id="soften" x="-50%" y="-50%" width="200%" height="200%">
    <feGaussianBlur stdDeviation="2.5" />
</filter>
```

Add to the `<style>` block:

```css
.panel label:has(input[type='radio']) {
    grid-template-columns: auto 1fr;
}

body[data-style='soft'] .shadows use {
    filter: url(#soften);
}

/* The extruded trail only exists in long mode. */
.trail {
    display: none;
}

body[data-style='long'] .trail {
    display: block;
}
```

- [ ] **Step 3: Add the extruded trail layers**

Insert inside `<g class="shadows">`, before `#shadow-a`:

```html
<g class="trail" id="trail-a" fill="var(--light-b)"></g>
<g class="trail" id="trail-b" fill="var(--light-a)"></g>
```

- [ ] **Step 4: Wire the styles**

Add inside the `<script type="module">`, before the final `render()` call:

```js
const LONG_STEPS = 24
const trails = { a: document.querySelector('#trail-a'), b: document.querySelector('#trail-b') }

// A long shadow is the same silhouette repeated along the offset direction,
// which reads as one extruded solid rather than 24 separate copies because
// the steps overlap.
function renderLong() {
    for (const which of ['a', 'b']) {
        const { x, y } = shadowOffset({ ...lights[which], distance: lights[which].distance * 5 })
        const steps = []
        for (let step = 1; step <= LONG_STEPS; step += 1) {
            const fraction = step / LONG_STEPS
            steps.push(
                `<use href="#sigill" width="100.08" height="98.16" ` +
                    `transform="translate(${(x * fraction).toFixed(2)} ${(y * fraction).toFixed(2)})"/>`,
            )
        }
        trails[which].innerHTML = steps.join('')
    }
}
```

Then extend `render()` — replace its body's final line so it reads:

```js
function render() {
    const a = shadowOffset(lights.a)
    const b = shadowOffset(lights.b)
    shadowA.setAttribute('transform', `translate(${a.x.toFixed(2)} ${a.y.toFixed(2)})`)
    shadowB.setAttribute('transform', `translate(${b.x.toFixed(2)} ${b.y.toFixed(2)})`)
    if (document.body.dataset.style === 'long') renderLong()
}
```

And add the selector wiring:

```js
document.body.dataset.style = 'hard'
for (const radio of document.querySelectorAll('input[name="style"]')) {
    radio.addEventListener('change', () => {
        if (!radio.checked) return
        document.body.dataset.style = radio.value
        render()
    })
}
```

- [ ] **Step 5: Verify all three styles**

Reload and switch between them while moving the pointer.

Expected:
- **Hård** — crisp offset copies, as before.
- **Mjuk** — both shadows blurred, overlap still darker than either.
- **Lång** — each shadow becomes a solid band running away from its light, and
  the bands follow the pointer without visible banding between steps.

If the long shadow shows stripes, `LONG_STEPS` is too low for the current
distance — raise it rather than shortening the shadow.

The long shadow reaches five times the slider distance, so at the top of the
range it runs well outside the SVG's viewBox. `.mark` has `overflow: visible`,
so it paints outside without pushing anything around — layout stays put, which
is what matters. If it paints over the control panel badly enough to get in the
way, lower the `* 5` multiplier in `renderLong()`; do not add `overflow: hidden`,
which would crop the shadow at the box edge and ruin the effect.

- [ ] **Step 6: Verify the mark holds at nav size**

Add `?small` handling is not needed — instead, in the browser's dev tools,
select the `<figure class="stage">` element and set its width to `40px`.

Expected: at 40px the sigil is still legible as a `#` with an `H` in it, the two
shadows still read as two distinct colours, and the overlap is still visibly
darker. Switch through all three styles at this size.

This is the size the nav and footer marks use, and it is where the effect is
most likely to collapse into mud. If the shadows swamp the mark, note the
distance value at which it stops working — a shipped version will need to scale
distance with the mark's size, and that number is the input for it.

- [ ] **Step 7: Commit**

```bash
cd web/main
git add demo-logo.html
git commit demo-logo.html -m "feat(demo): add soft and long shadow styles

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Device tilt and touch fallback

**Files:**
- Modify: `demo-logo.html`

**Interfaces:**
- Consumes: `lights`, `render()`, `MOTION_OK` from Task 3.
- Produces: nothing later tasks depend on. This is the last task.

- [ ] **Step 1: Add the permission button markup**

Insert immediately after the opening `<body>` tag:

```html
<button type="button" id="tilt" hidden>Tillåt rörelse</button>
```

Add to the `<style>` block:

```css
#tilt {
    justify-self: center;
    padding: 0.6rem 1.2rem;
    border: 1px solid var(--ink);
    border-radius: 999px;
    background: transparent;
    color: var(--ink);
    font: inherit;
    cursor: pointer;
}

#tilt[hidden] {
    display: none;
}
```

- [ ] **Step 2: Wire tilt, permission and touch fallback**

Add inside the `<script type="module">`, before the final `render()` call.
Extend the import at the top of the script to
`import { shadowOffset, lightFromPointer, lightFromTilt } from './assets/light-math.mjs'`:

```js
const TILT_OPTS = { range: 30, restBeta: 45, minDistance: 4, maxDistance: 14 }

const tiltButton = document.querySelector('#tilt')

function startTilt() {
    window.addEventListener('deviceorientation', (event) => {
        lights.b = lightFromTilt({ beta: event.beta, gamma: event.gamma }, TILT_OPTS)
        render()
    })
}

// Touch drag is the fallback, not an enhancement: iOS only hands over
// orientation data in a secure context and only after an explicit gesture,
// and someone who declines must still get a working page.
function startTouch() {
    document.addEventListener(
        'touchmove',
        (event) => {
            const touch = event.touches[0]
            if (!touch) return
            lights.b = lightFromPointer(
                { x: touch.clientX, y: touch.clientY },
                centreOfMark(),
                POINTER_OPTS,
            )
            render()
        },
        { passive: true },
    )
}

const needsPermission =
    typeof DeviceOrientationEvent !== 'undefined' &&
    typeof DeviceOrientationEvent.requestPermission === 'function'

if (MOTION_OK && needsPermission) {
    tiltButton.hidden = false
    tiltButton.addEventListener('click', async () => {
        tiltButton.hidden = true
        try {
            if ((await DeviceOrientationEvent.requestPermission()) === 'granted') {
                startTilt()
                return
            }
        } catch {
            // Permission call rejects outside a secure context; fall through.
        }
        startTouch()
    })
} else if (MOTION_OK && 'ondeviceorientation' in window) {
    startTilt()
} else if (MOTION_OK) {
    startTouch()
}
```

- [ ] **Step 3: Confirm the fallback path over plain HTTP**

With `python3 -m http.server 8000` running, open
`http://10.10.10.222:8000/demo-logo.html` on an iPhone and tap **Tillåt
rörelse**.

Expected: over plain HTTP the permission call fails, the button disappears, and
dragging a finger across the screen moves the mint shadow. This is the declined
path, and verifying it here is the point — it must work before tilt is tested.

- [ ] **Step 4: Test tilt over HTTPS**

```bash
brew install cloudflared
cloudflared tunnel --url http://localhost:8000
```

Open the printed `https://….trycloudflare.com/demo-logo.html` on the phone and
tap **Tillåt rörelse**.

Expected: iOS shows its motion-access prompt. On allowing it, tilting the phone
left and right swings the mint shadow, and tilting it away from you moves the
shadow up the screen. Extreme angles saturate rather than flipping the light to
the opposite side.

If the shadow moves the wrong way on one axis, the sign of that axis in
`lightFromTilt` is inverted — fix it in `assets/light-math.mjs`, add a test in
`test/light-math.test.mjs` asserting the corrected direction, and re-run
`node --test test/`.

- [ ] **Step 5: Run the full test suite**

```bash
cd web/main && node --test test/
```

Expected: PASS, 12 tests (more if Step 4 required a correction).

- [ ] **Step 6: Commit**

```bash
cd web/main
git add demo-logo.html
git commit demo-logo.html -m "feat(demo): steer the light by device tilt, with touch fallback

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Done when

- `node --test test/` passes from `web/main`
- `demo-logo.html` renders two coloured shadows with a dark overlap, both at
  hero size and with `.stage` forced to 40px (Task 5, Step 6)
- The pointer steers one shadow on desktop; tilt or drag steers it on mobile
- Disabling JavaScript still leaves a correctly rendered two-shadow mark
- `prefers-reduced-motion` holds the lights still
- Nothing is pushed, and `git log --stat` shows no `src/` or `public/` deletions
  in any of the six commits
