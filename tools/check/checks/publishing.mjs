/**
 * The deploy is the repo root and a push to `main` is a publish: the Worker
 * serves `main:/` at the apex, with no build step in between. Nothing
 * downstream will catch a missing surface or a committed build directory — by
 * the time it is on `main` it is already live.
 */

export const name = "publishing";
export const summary = "the repo root is safe to serve as the site";

export function run(site, facts, report) {
  for (const file of facts.requiredFiles) {
    if (!site.has(file)) {
      report.fail(file, "required at the repo root — the Worker serves this directory as the site");
    }
  }

  checkRobots(site, facts, report);

  for (const pattern of facts.neverPublished) {
    const expression = new RegExp(pattern);
    for (const file of site.trackedMatching(expression)) {
      report.fail(file, `must never be committed — a push to main would publish it`);
    }
  }
}

function checkRobots(site, facts, report) {
  const robots = site.read("robots.txt");
  if (robots === null) return;

  const signal = robots.match(/^Content-Signal:.*$/m);
  if (!signal) {
    report.fail("robots.txt", "no Content-Signal line — the published stance on AI training would be unstated");
  } else if (!signal[0].includes(facts.contentSignal)) {
    report.fail(
      "robots.txt",
      `Content-Signal no longer carries "${facts.contentSignal}" — this is the published position on model training`,
    );
  }

  const sitemap = robots.match(/^Sitemap:\s*(\S+)\s*$/m);
  if (!sitemap) {
    report.fail("robots.txt", "no Sitemap: line");
  } else if (!sitemap[1].endsWith("/sitemap.xml")) {
    report.fail("robots.txt", `Sitemap: points at ${sitemap[1]}, which is not the site's sitemap.xml`);
  }
}
