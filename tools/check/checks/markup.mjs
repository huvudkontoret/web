/**
 * Structural checks on the hand-written page — the mistakes that survive a
 * glance in the browser because the parser silently recovers, and then break
 * a screen reader, a crawler or a preview card.
 *
 * Deliberately offline and deliberately narrow. Elements whose end tag HTML
 * lets you omit are not balance-checked at all: a false failure on markup a
 * person wrote by hand costs more than the miss.
 */

import { attributes, lineAt, stripRawText, tags, unbalanced } from "../lib/html.mjs";

export const name = "markup";
export const summary = "index.html is structurally sound";

export function run(site, facts, report) {
  const html = site.read("index.html");
  if (html === null) return;
  const markup = stripRawText(html);
  const at = (index) => `index.html:${lineAt(html, index)}`;

  for (const issue of unbalanced(markup)) {
    const message =
      issue.kind === "unclosed"
        ? `<${issue.name}> is never closed`
        : `</${issue.name}> closes a tag that was never opened`;
    report.fail(at(issue.index), message);
  }

  const openTags = tags(markup).filter((tag) => !tag.closing);

  const htmlTag = openTags.find((tag) => tag.name === "html");
  if (!htmlTag) {
    report.fail("index.html", "no <html> element");
  } else if (!attributes(htmlTag.attrs).lang) {
    report.fail(at(htmlTag.index), "<html> has no lang attribute — assistive tech and translation depend on it");
  }

  const titles = [...markup.matchAll(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/gi)];
  if (titles.length === 0) {
    report.fail("index.html", "no <title>");
  } else if (titles.length > 1) {
    report.fail(at(titles[1].index), `${titles.length} <title> elements — there must be exactly one`);
  } else if (titles[0][1].trim() === "") {
    report.fail(at(titles[0].index), "<title> is empty");
  }

  for (const tag of openTags) {
    if (tag.name !== "img") continue;
    const attrs = attributes(tag.attrs);
    if (attrs.alt === undefined) {
      report.fail(at(tag.index), `<img src="${attrs.src ?? "?"}"> has no alt attribute`);
    }
  }

  if (!/^\s*<!doctype html>/i.test(html)) {
    report.fail("index.html:1", "no <!doctype html> — browsers fall back to quirks mode");
  }
}
