/**
 * MonoLisa is a purchased typeface and this repo is public: committing a
 * .woff2 here would publish it. Whether that is allowed is one fact,
 * `webFontLicence`, and this check reads it in both directions.
 *
 * The mistake is quiet and one-way. Once a font file lands on `main` it has
 * been served from huvudkontoret.io, and deleting the file later does not
 * undo that. This check is the one place that can stop it.
 *
 * Once the licence is confirmed the danger inverts: the page names two files
 * by hand, and a missing or misnamed one is a site that silently falls back
 * to system monospace. So the check then holds the directory to exactly the
 * licensed set. Lifting it is a runbook:
 * docs/runbooks/2026-08-26-monolisa-webfont-cutover.md.
 */

export const name = "fonts";
export const summary = "the licensed fonts are carried exactly as licensed";

const IGNORE_RULE = /assets\/fonts\/\*\.woff2/;

export function run(site, facts, report) {
  const licensed = new RegExp(facts.licensedFontPattern);
  const tracked = site.trackedMatching(licensed);
  const gitignore = site.read(".gitignore") ?? "";

  if (facts.webFontLicence) {
    checkLicensed(site, facts, tracked, gitignore, report);
    return;
  }
  checkUnlicensed(site, tracked, gitignore, report);
}

/** No font file may be committed, and the rule that keeps it that way stands. */
function checkUnlicensed(site, tracked, gitignore, report) {
  for (const file of tracked) {
    report.fail(
      file,
      "licensed font file is tracked by git — a push to main would publish it. " +
        "Remove it from the index (git rm --cached) and keep it ignored until the web licence is confirmed.",
    );
  }

  // The ignore rule is the thing that keeps this true by default; if it goes,
  // the next `git add -A` publishes the fonts silently.
  if (site.trackedMatching(/^assets\/fonts\//).length > 0 && !IGNORE_RULE.test(gitignore)) {
    report.fail(
      ".gitignore",
      "the assets/fonts/*.woff2 ignore rule is gone — nothing prevents the licensed fonts from being committed",
    );
  }
}

/** Exactly the licensed files, actually committed, with the ignore rule lifted. */
function checkLicensed(site, facts, tracked, gitignore, report) {
  for (const expected of facts.licensedWebFonts) {
    if (!site.has(expected)) {
      report.fail(
        expected,
        "webFontLicence is set but this file is not tracked — index.html names it, so the site would fall back " +
          "to system monospace. Build it with MonoLisa's own webfont tool; see assets/fonts/README.md.",
      );
    }
  }

  for (const file of tracked) {
    if (facts.licensedWebFonts.includes(file)) continue;
    report.fail(
      file,
      "is not one of the licensed files in licensedWebFonts — the licence is per weight and per file, so an " +
        "extra one is published without being covered. Remove it, or license it and add it to facts.json.",
    );
  }

  if (IGNORE_RULE.test(gitignore)) {
    report.fail(
      ".gitignore",
      "still ignores assets/fonts/*.woff2 while webFontLicence is set — the fonts cannot be committed at all. " +
        "Drop this rule and the matching .assetsignore rule together.",
    );
  }
}
