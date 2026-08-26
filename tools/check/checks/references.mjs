/**
 * Every local thing the site points at has to exist for everyone, not just on
 * the author's machine. A push to `main` is a publish, so a reference that
 * resolves locally and 404s in production is the exact failure this catches.
 */

import { attributes, ids, lineAt, references, stripRawText, tags } from "../lib/html.mjs";
import { toRepoPath } from "../lib/site.mjs";

export const name = "references";
export const summary = "local links, assets and anchors resolve";

export function run(site, facts, report) {
  const licensedFont = new RegExp(facts.licensedFontPattern);

  for (const surface of ["index.html"]) {
    const html = site.read(surface);
    if (html === null) {
      report.fail(surface, `missing — the gate cannot check a page that is not there`);
      continue;
    }
    const markup = stripRawText(html);

    checkReferences(site, facts, surface, html, markup, licensedFont, report);
    checkAnchors(surface, html, markup, report);
  }
}

function checkReferences(site, facts, surface, html, markup, licensedFont, report) {
  // References are read from the full source: CSS url() lives inside <style>,
  // which stripRawText blanks out.
  for (const reference of references(html)) {
    const path = toRepoPath(reference.url, site, facts);
    if (path === null) continue;

    if (licensedFont.test(path)) {
      // Deliberately untracked until the web licence is confirmed; the fonts
      // check owns the other half of this rule.
      continue;
    }
    if (!site.has(path)) {
      report.fail(
        `${surface}:${lineAt(html, reference.index)}`,
        `${reference.from} points at "${reference.url}" — ${path} is not tracked by git`,
      );
    }
  }
}

function checkAnchors(surface, html, markup, report) {
  const defined = new Set();

  for (const entry of ids(markup)) {
    if (defined.has(entry.id)) {
      report.fail(`${surface}:${lineAt(html, entry.index)}`, `duplicate id "${entry.id}"`);
    }
    defined.add(entry.id);
  }

  for (const tag of tags(markup)) {
    if (tag.closing) continue;
    const href = attributes(tag.attrs).href;
    if (!href || !href.startsWith("#") || href === "#") continue;
    const target = decodeURIComponent(href.slice(1));
    if (!defined.has(target)) {
      report.fail(`${surface}:${lineAt(html, tag.index)}`, `anchor "${href}" has no matching id`);
    }
  }
}
