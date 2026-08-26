/**
 * The Cloudflare side of publishing.
 *
 * The asset directory is the repo root, so the question "what is the site?"
 * is answered by .assetsignore and nothing else. Getting it wrong is quiet in
 * both directions: too little and a surface agents rely on stops resolving,
 * too much and the repo's scaffolding is served from huvudkontoret.io. This
 * check pins the answer down and fails on anything it cannot read.
 */

import { parseJsonc } from "../lib/jsonc.mjs";
import { matchesAny, parsePatterns } from "../lib/patterns.mjs";

export const name = "workers";
export const summary = "the Worker publishes exactly the site";

export function run(site, facts, report) {
  const config = readConfig(site, report);
  if (config) checkConfig(config, facts, report);
  checkPublishedSet(site, facts, report);
}

function readConfig(site, report) {
  const text = site.read("wrangler.jsonc");
  if (text === null) {
    report.fail("wrangler.jsonc", "missing — this is what serves the site");
    return null;
  }
  try {
    return parseJsonc(text);
  } catch (error) {
    report.fail("wrangler.jsonc", `does not parse: ${error.message}`);
    return null;
  }
}

function checkConfig(config, facts, report) {
  if (config.assets?.directory !== ".") {
    report.fail(
      "wrangler.jsonc",
      `assets.directory is ${JSON.stringify(config.assets?.directory)}, expected "." — the site is the repo root`,
    );
  }

  // `wrangler deploy` creates the custom domains it finds in this file, so the
  // route appearing here is the cutover itself — it moves huvudkontoret.io off
  // GitHub Pages as soon as the production build runs. The gate therefore
  // guards it in both directions: it may not arrive before the decision, and
  // it may not go missing after.
  const domains = (config.routes ?? []).filter((route) => route.custom_domain).map((route) => route.pattern);
  const serving = domains.includes(facts.apexHostname);

  if (facts.expectCustomDomain && !serving) {
    report.fail(
      "wrangler.jsonc",
      `no custom_domain route for ${facts.apexHostname} — found ${domains.length ? domains.join(", ") : "none"}. ` +
        "Without it the Worker serves only its workers.dev URL.",
    );
  }
  if (!facts.expectCustomDomain && serving) {
    report.fail(
      "wrangler.jsonc",
      `adds a custom_domain route for ${facts.apexHostname}, which performs the cutover on the next production ` +
        "deploy. If that is the intent, set expectCustomDomain in facts.json in the same change and follow " +
        "docs/runbooks/2026-08-12-pages-to-workers-cutover.md.",
    );
  }

  if (config.preview_urls !== true) {
    report.fail(
      "wrangler.jsonc",
      'preview_urls is not true — pull requests would get no browsable preview. ' +
        "Note this setting is re-applied on every deploy, so the dashboard toggle alone does not hold.",
    );
  }
}

function checkPublishedSet(site, facts, report) {
  const text = site.read(".assetsignore");
  if (text === null) {
    report.fail(".assetsignore", "missing — the entire repo root would be served as the site");
    return;
  }

  const { patterns, unsupported } = parsePatterns(text);

  checkAlwaysIgnored(text, facts, report);
  for (const pattern of unsupported) {
    report.fail(
      `.assetsignore:${pattern.number}`,
      `"${pattern.line}" uses syntax this gate does not read (negation, **, ?, character classes). ` +
        "Rewrite it as a plain name, a dir/ or a *.ext, so what reaches production stays checkable.",
    );
  }

  const published = [...site.tracked].filter((file) => !matchesAny(patterns, file)).sort();
  const allowed = facts.publishedPaths;

  for (const file of published) {
    if (!matchesAny(allowed, file)) {
      report.fail(
        file,
        "would be served from the site but is not part of it — add it to .assetsignore, " +
          "or to publishedPaths in facts.json if it genuinely belongs on the site",
      );
    }
  }

  for (const required of facts.requiredPublished) {
    if (!site.has(required)) continue;
    if (matchesAny(patterns, required)) {
      report.fail(".assetsignore", `excludes ${required}, which the site and its agent surfaces depend on`);
    }
  }

  checkLicensedFonts(site, facts, patterns, report);
}

/**
 * The blind spot in the check above.
 *
 * `checkPublishedSet` derives what reaches the site from the files git tracks,
 * which is right for everything the repo contains and wrong for everything it
 * does not. `.git/` and `.wrangler/` are never tracked, are always present in
 * the directory wrangler uploads, and were therefore invisible: the 2026-08-26
 * cutover build published /.git/HEAD, /.git/index and /.git/objects/... with a
 * green gate. Nothing can be inferred here, so the paths are listed in
 * facts.json and each one has to be named in .assetsignore.
 */
function checkAlwaysIgnored(text, facts, report) {
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  for (const path of facts.alwaysIgnored ?? []) {
    if (!lines.includes(path)) {
      report.fail(
        ".assetsignore",
        `does not exclude ${path}, which git never tracks and wrangler uploads anyway — ` +
          "it would be served from the site. Add it verbatim, or drop it from alwaysIgnored in facts.json.",
      );
    }
  }
}

/**
 * Wrangler uploads the working directory, not the git tree. Keeping the fonts
 * out of git therefore does not keep them off the site — a local
 * `wrangler deploy` would publish them. The two rules have to move together.
 */
function checkLicensedFonts(site, facts, patterns, report) {
  const gitignore = site.read(".gitignore") ?? "";
  const stillUnlicensed = /assets\/fonts\/\*\.woff2/.test(gitignore);
  if (!stillUnlicensed) return;

  if (!matchesAny(patterns, "assets/fonts/MonoLisa-Regular.woff2")) {
    report.fail(
      ".assetsignore",
      "does not exclude assets/fonts/*.woff2 while .gitignore still does. Wrangler uploads the working " +
        "directory, so a local deploy would publish the licensed fonts. Remove both rules together or neither.",
    );
  }
}
