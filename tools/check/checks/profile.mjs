/**
 * The graphic profile is declared twice, and this is what keeps the two
 * copies honest.
 *
 * `.io` is hand-written and byte-exact, so its `:root` block carries the
 * profile inline; `src/styles/profile.css` carries the same properties for
 * everything the chrome will render (ADR 0004). Nothing generates one from
 * the other — ADR 0002 refused a token pipeline for eighteen values that
 * change a few times a year, and that decision stands.
 *
 * What ADR 0002 could only state as a convention was the direction of drift:
 * *when the two encodings disagree, the CSS is right*. Nothing enforced it.
 * This check does, at the only cost the decision allows — a comparison, not
 * a build step.
 *
 * The comparison is strict, after collapsing whitespace inside a value. The
 * two blocks are meant to be the same eighteen declarations, so anything that
 * differs at all is worth a human glance, and the fix is never more than a
 * line. A check that quietly tolerated near-matches would be a check nobody
 * trusts.
 */

export const name = "profile";
export const summary = "the profile's custom properties agree in both places";

/** CSS has no nested comments, so one pass is enough — and it must run before
 *  any brace counting, or a `{` inside a comment throws the depth off. */
function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/**
 * The `:root` blocks that apply unconditionally.
 *
 * Depth is the whole point: `index.html` also declares `:root { --gut: 20px }`
 * inside a `@media` query, and a responsive override is not a disagreement
 * about the profile. Only blocks at brace depth zero are the contact surface.
 */
function rootBlocks(css) {
  const text = stripComments(css);
  const blocks = [];
  let depth = 0;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (character === "}") {
      depth -= 1;
      continue;
    }
    if (character === "{") {
      depth += 1;
      continue;
    }
    if (depth !== 0 || !text.startsWith(":root", index)) continue;

    // `:root` at top level, but only a selector if a block actually opens.
    let cursor = index + ":root".length;
    while (cursor < text.length && /\s/.test(text[cursor])) cursor += 1;
    if (text[cursor] !== "{") continue;

    const open = cursor;
    let inner = 1;
    cursor += 1;
    while (cursor < text.length && inner > 0) {
      if (text[cursor] === "{") inner += 1;
      else if (text[cursor] === "}") inner -= 1;
      cursor += 1;
    }
    if (inner !== 0) break; // unbalanced; the markup check owns that failure

    blocks.push(text.slice(open + 1, cursor - 1));
    index = cursor - 1;
  }

  return blocks;
}

/** Later declarations win, exactly as the cascade would resolve them. */
function customProperties(css) {
  const properties = new Map();
  for (const block of rootBlocks(css)) {
    for (const [, property, value] of block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
      properties.set(property, value.replace(/\s+/g, " ").trim());
    }
  }
  return properties;
}

/** Only the inline stylesheets — an external <link> is a different file. */
function styleBlocks(html) {
  return [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((match) => match[1]).join("\n");
}

export function run(site, facts, report) {
  const pagePath = facts.profileContactSurface;
  const sheetPath = facts.profileStylesheet;

  const page = site.read(pagePath);
  const sheet = site.read(sheetPath);

  // A missing half is not a pass. Deleting either file would otherwise turn
  // this check off without anyone deciding to.
  if (page === null) {
    report.fail(pagePath, `the profile's inline contact surface is missing — facts.json names it as profileContactSurface`);
    return;
  }
  if (sheet === null) {
    report.fail(sheetPath, `the shared profile stylesheet is missing — facts.json names it as profileStylesheet`);
    return;
  }

  const inPage = customProperties(styleBlocks(page));
  const inSheet = customProperties(sheet);

  if (inPage.size === 0) {
    report.fail(pagePath, "no top-level :root block found — the profile has to be declared somewhere the chrome can be compared against");
    return;
  }
  if (inSheet.size === 0) {
    report.fail(sheetPath, "no top-level :root block found — this file exists to hold one");
    return;
  }

  for (const [property, value] of inPage) {
    if (!inSheet.has(property)) {
      report.fail(sheetPath, `${property} is declared in ${pagePath} but not here — the chrome cannot use a property it does not have`);
      continue;
    }
    const theirs = inSheet.get(property);
    if (theirs !== value) {
      report.fail(
        sheetPath,
        `${property} is "${theirs}" here and "${value}" in ${pagePath} — ` +
          "the page is the profile's realisation, so it is the one to follow (ADR 0002)",
      );
    }
  }

  for (const property of inSheet.keys()) {
    if (inPage.has(property)) continue;
    report.fail(
      sheetPath,
      `${property} is declared here but not in ${pagePath} — either the page has fallen behind the profile, ` +
        "or this is a local implementation detail that does not belong in the contact surface",
    );
  }
}
