/**
 * MonoLisa is a purchased typeface and this repo is public: committing a
 * .woff2 here would publish it. The web licence is not confirmed, so the web
 * files are generated locally and stay out of git — see assets/fonts/README.md.
 *
 * The mistake is quiet and one-way. Once a font file lands on `main` it has
 * been served from huvudkontoret.io, and deleting the file later does not
 * undo that. This check is the one place that can stop it.
 */

export const name = "fonts";
export const summary = "no licensed font file is committed";

export function run(site, facts, report) {
  const licensed = new RegExp(facts.licensedFontPattern);

  for (const file of site.trackedMatching(licensed)) {
    report.fail(
      file,
      "licensed font file is tracked by git — a push to main would publish it. " +
        "Remove it from the index (git rm --cached) and keep it ignored until the web licence is confirmed.",
    );
  }

  // The ignore rule is the thing that keeps this true by default; if it goes,
  // the next `git add -A` publishes the fonts silently.
  const gitignore = site.read(".gitignore") ?? "";
  if (site.trackedMatching(/^assets\/fonts\//).length > 0 && !/assets\/fonts\/\*\.woff2/.test(gitignore)) {
    report.fail(
      ".gitignore",
      "the assets/fonts/*.woff2 ignore rule is gone — nothing prevents the licensed fonts from being committed",
    );
  }
}
