/**
 * The sitemap is how the site is found, not a courtesy to crawlers.
 * `robots.txt` names it as the entry point, and `llms-full.txt` is linked from
 * nowhere else on the site at all — so a surface missing from this file is
 * published and undiscoverable at the same time. Served correctly, found by
 * nobody.
 *
 * Both directions are asserted, because only one of them is loud. An entry
 * pointing at nothing 404s the moment somebody follows it. A published page
 * with no entry looks exactly like a site that has fewer pages, and nothing
 * downstream ever complains.
 *
 * Which pages belong here is declared in facts.json rather than derived from
 * the published set: `robots.txt`, `sitemap.xml` and everything under
 * `assets/` are published without being pages, and that distinction is
 * editorial, not mechanical.
 */

import { origin, toRepoPath } from "../lib/site.mjs";

export const name = "sitemap";
export const summary = "the sitemap advertises every public page, and only pages";

export function run(site, facts, report) {
  const xml = site.read("sitemap.xml");
  if (xml === null) {
    report.fail("sitemap.xml", "missing");
    return;
  }

  const locations = [...xml.matchAll(/<loc>\s*([^<]*?)\s*<\/loc>/g)].map((match) => match[1]);
  if (locations.length === 0) {
    report.fail("sitemap.xml", "no <loc> entries — nothing is being advertised to crawlers");
  }

  checkEntriesResolve(site, locations, report);
  checkPagesAdvertised(site, facts, locations, report);
}

/** Every entry points at something this repo actually publishes. */
function checkEntriesResolve(site, locations, report) {
  const site_origin = origin(site);

  for (const location of locations) {
    if (site_origin && !location.startsWith(site_origin)) {
      report.fail("sitemap.xml", `<loc>${location}</loc> is not on ${site_origin}`);
      continue;
    }
    const path = toRepoPath(location, site);
    if (path && !site.has(path)) {
      report.fail("sitemap.xml", `<loc>${location}</loc> resolves to ${path}, which is not tracked by git`);
    }
  }
}

/**
 * Every declared page is advertised, in its canonical form, and nothing else
 * is. The canonical case is separate on purpose: a sitemap carrying both `/`
 * and `/index.html` is not a missing page, it is the same page twice, and the
 * fix is a different one.
 */
function checkPagesAdvertised(site, facts, locations, report) {
  const site_origin = origin(site);
  // Without a CNAME there is no origin to build canonical URLs from; the
  // publishing check owns that failure and this one has nothing to say.
  if (!site_origin) return;

  const canonical = new Map();
  for (const page of facts.sitemapPages ?? []) {
    // Declared but absent from this checkout — a branch mid-change is not a
    // defect, and `workers` already owns the required-file question.
    if (!site.has(page)) continue;
    canonical.set(page, page === "index.html" ? `${site_origin}/` : `${site_origin}/${page}`);
  }

  const listed = new Map();
  for (const location of locations) {
    const path = toRepoPath(location, site);
    if (path !== null) listed.set(path, location);
  }

  for (const [page, url] of canonical) {
    const found = listed.get(page);
    if (found === undefined) {
      report.fail(
        "sitemap.xml",
        `${page} is published but has no <loc> — robots.txt sends crawlers to this file, so a page missing ` +
          `from it is a page nobody finds. Add <loc>${url}</loc>, or drop ${page} from sitemapPages in facts.json.`,
      );
    } else if (found !== url) {
      report.fail(
        "sitemap.xml",
        `<loc>${found}</loc> reaches ${page} by a non-canonical URL — use ${url}, so the same page is not ` +
          "advertised under two addresses",
      );
    }
  }

  for (const [path, location] of listed) {
    if (canonical.has(path) || !site.has(path)) continue;
    report.fail(
      "sitemap.xml",
      `<loc>${location}</loc> advertises ${path}, which is not one of the site's pages — add it to ` +
        "sitemapPages in facts.json if it is one, or remove the entry",
    );
  }
}
