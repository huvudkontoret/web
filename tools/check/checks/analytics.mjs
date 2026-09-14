/**
 * Cloudflare Web Analytics is the site's only measurement: one cookieless
 * beacon per page, identified by the site token, reporting page views,
 * referrers, devices and Core Web Vitals per path — nothing that identifies a
 * person, which is why no consent banner comes with it.
 *
 * It has gone missing once already. The homepage rebuild (8a67aa5) dropped the
 * snippet and nothing noticed until the numbers were read; the press kit
 * shipped without it from day one. Nothing downstream notices a page that
 * stops reporting — the dashboard just goes quiet — so the token is a fact in
 * facts.json and every declared page is held to it here.
 */

import { attributes, lineAt, tags } from "../lib/html.mjs";

export const name = "analytics";
export const summary = "every page carries the Web Analytics beacon, once, with the site's token";

export function run(site, facts, report) {
  for (const page of facts.pages) checkPage(site, page, facts.analytics, report);
}

function checkPage(site, page, analytics, report) {
  const html = site.read(page);
  if (html === null) return;

  // Comments are blanked with offsets kept: a beacon commented out while
  // debugging is a beacon that is gone, and the line numbers still have to be right.
  const markup = html.replace(/<!--[\s\S]*?-->/g, (comment) => comment.replace(/[^\n]/g, " "));
  const at = (index) => `${page}:${lineAt(html, index)}`;

  const beacons = tags(markup).filter(
    (tag) => !tag.closing && tag.name === "script" && attributes(tag.attrs).src === analytics.script,
  );

  if (beacons.length === 0) {
    report.fail(
      page,
      `no Cloudflare Web Analytics beacon — every page in facts.json's pages carries ` +
        `<script src="${analytics.script}"> with the site token, or it is published unmeasured`,
    );
    return;
  }

  if (beacons.length > 1) {
    report.fail(
      at(beacons[1].index),
      `the beacon appears ${beacons.length} times — once is the whole contract; ` +
        "twice is what a merge that kept both sides looks like",
    );
  }

  for (const beacon of beacons) {
    const config = attributes(beacon.attrs)["data-cf-beacon"];
    if (config === undefined) {
      report.fail(at(beacon.index), "the beacon has no data-cf-beacon attribute, so it reports to nobody");
      continue;
    }
    let token;
    try {
      token = JSON.parse(config).token;
    } catch {
      token = undefined;
    }
    if (token !== analytics.token) {
      report.fail(
        at(beacon.index),
        `the beacon's token is ${JSON.stringify(token ?? config)}, not the site's ${analytics.token} — ` +
          "it would report to another site, or to nobody",
      );
    }
  }
}
