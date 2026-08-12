/**
 * Tests for the gate itself.
 *
 * A gate nobody has tried to break is just a green tick. Each case seeds a
 * throwaway git repo, introduces exactly one defect, and asserts the check
 * notices — plus the cases that must NOT fire, which are the ones that would
 * otherwise make the gate untrustworthy and get switched off.
 *
 *   node --test tools/check/
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, test } from "node:test";

import * as fonts from "./checks/fonts.mjs";
import * as formatting from "./checks/formatting.mjs";
import * as markup from "./checks/markup.mjs";
import * as publishing from "./checks/publishing.mjs";
import * as references from "./checks/references.mjs";
import * as surfaces from "./checks/surfaces.mjs";
import { loadSite } from "./lib/site.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const FACTS = JSON.parse(readFileSync(join(HERE, "facts.json"), "utf8"));

const TEAM = "Hanna Wikman, Magnus Renholm, Sebastian Berglönn";
const CONTACT = "hej@huvudkontoret.io";

/** A minimal site that passes every check — the baseline each case perturbs. */
function baseline() {
  return {
    "CNAME": "huvudkontoret.io\n",
    ".nojekyll": "",
    ".gitignore": "assets/fonts/*.woff2\n",
    "index.html": [
      "<!doctype html>",
      '<html lang="sv">',
      "<head><title>Huvudkontoret</title></head>",
      "<body>",
      '  <nav><a href="#contact">Kontakt</a></nav>',
      '  <img src="assets/logo.svg" alt="Logotyp">',
      `  <p>${TEAM}</p>`,
      `  <section id="contact">${CONTACT}</section>`,
      "</body>",
      "</html>",
      "",
    ].join("\n"),
    "index.md": `# Huvudkontoret\n\n${TEAM}\n\n${CONTACT}\n`,
    "llms.txt": `# Huvudkontoret\n\n${TEAM}\n\n${CONTACT}\n`,
    "robots.txt": "User-agent: *\nAllow: /\n\nContent-Signal: search=yes, ai-input=yes, ai-train=no\nSitemap: https://huvudkontoret.io/sitemap.xml\n",
    "sitemap.xml": '<?xml version="1.0" encoding="UTF-8"?>\n<urlset><url><loc>https://huvudkontoret.io/</loc></url></urlset>\n',
    "assets/logo.svg": '<svg xmlns="http://www.w3.org/2000/svg"></svg>\n',
  };
}

const fixtures = [];
after(() => {
  for (const dir of fixtures) rmSync(dir, { recursive: true, force: true });
});

/** Findings from one check against a site built from `files`. */
function findings(check, files) {
  const root = mkdtempSync(join(tmpdir(), "web-gate-"));
  fixtures.push(root);
  execFileSync("git", ["init", "-q"], { cwd: root });

  for (const [path, content] of Object.entries(files)) {
    if (content === null) continue;
    mkdirSync(join(root, dirname(path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  // -f so fixtures can stage a file the fixture's own .gitignore excludes.
  execFileSync("git", ["add", "-A", "-f", "."], { cwd: root });

  const collected = [];
  check.run(loadSite(root), FACTS, {
    fail: (where, message) => collected.push({ where, message }),
  });
  return collected;
}

/** The baseline plus edits; a null value drops the file entirely. */
function withEdits(edits) {
  return { ...baseline(), ...edits };
}

function assertFires(check, edits, needle) {
  const found = findings(check, withEdits(edits));
  assert.ok(
    found.some((finding) => `${finding.where} ${finding.message}`.includes(needle)),
    `expected a finding mentioning "${needle}", got: ${JSON.stringify(found, null, 2)}`,
  );
}

function assertClean(check, edits = {}) {
  const found = findings(check, withEdits(edits));
  assert.deepEqual(found, [], `expected no findings, got: ${JSON.stringify(found, null, 2)}`);
}

test("baseline site passes every check", () => {
  for (const check of [publishing, references, markup, surfaces, fonts, formatting]) {
    assertClean(check);
  }
});

test("references: an asset that is not tracked is a finding", () => {
  assertFires(references, { "assets/logo.svg": null }, "assets/logo.svg is not tracked");
});

test("references: an anchor with no matching id is a finding", () => {
  assertFires(
    references,
    { "index.html": baseline()["index.html"].replace('href="#contact"', 'href="#kontakt"') },
    'anchor "#kontakt" has no matching id',
  );
});

test("references: a duplicate id is a finding", () => {
  assertFires(
    references,
    { "index.html": baseline()["index.html"].replace("<body>", '<body><div id="contact"></div>') },
    'duplicate id "contact"',
  );
});

test("references: a sitemap entry pointing at nothing is a finding", () => {
  assertFires(
    references,
    { "sitemap.xml": '<urlset><url><loc>https://huvudkontoret.io/nope.html</loc></url></urlset>\n' },
    "nope.html",
  );
});

test("references: the licensed fonts may be referenced while untracked", () => {
  // The whole point of the exception — index.html loads MonoLisa, git does not
  // carry it, and that combination has to stay green.
  assertClean(references, {
    "index.html": baseline()["index.html"].replace(
      "<head>",
      '<head><style>@font-face{src:url("assets/fonts/MonoLisa-Light.woff2")}</style>',
    ),
  });
});

test("fonts: a committed licensed font is a finding", () => {
  assertFires(fonts, { "assets/fonts/MonoLisa-Light.woff2": "not really a font" }, "would publish it");
});

test("fonts: losing the ignore rule is a finding once the font directory exists", () => {
  assertFires(
    fonts,
    { "assets/fonts/README.md": "notes\n", ".gitignore": "node_modules/\n" },
    "nothing prevents the licensed fonts",
  );
});

test("surfaces: a fact on some surfaces but not all is drift", () => {
  assertFires(surfaces, { "llms.txt": `# Huvudkontoret\n\n${CONTACT}\n` }, "Hanna Wikman");
});

test("surfaces: a fact stated nowhere is editorial, not drift", () => {
  const withoutTeam = (text) => text.replace(`${TEAM}\n`, "");
  assertClean(surfaces, {
    "index.html": baseline()["index.html"].replace(`  <p>${TEAM}</p>\n`, ""),
    "index.md": withoutTeam(baseline()["index.md"]),
    "llms.txt": withoutTeam(baseline()["llms.txt"]),
  });
});

test("surfaces: an announced address presented as live is a finding", () => {
  assertFires(surfaces, { "llms.txt": `${TEAM}\n${CONTACT}\n.vote visar riktningen. I drift.\n` }, '".vote"');
});

test("surfaces: the same address is fine once marked as not yet running", () => {
  assertClean(surfaces, {
    "index.html": baseline()["index.html"].replace("</body>", "<p>.vote visar riktningen. Snart.</p></body>"),
    "index.md": `${baseline()["index.md"]}\n.vote visar riktningen. Snart.\n`,
    "llms.txt": `${baseline()["llms.txt"]}\n.vote visar riktningen. Snart.\n`,
  });
});

test("publishing: the wrong CNAME is a finding", () => {
  assertFires(publishing, { CNAME: "example.com\n" }, "points the custom domain");
});

test("publishing: a missing .nojekyll is a finding", () => {
  assertFires(publishing, { ".nojekyll": null }, "Jekyll would drop dot-directories");
});

test("publishing: dropping ai-train=no from Content-Signal is a finding", () => {
  assertFires(
    publishing,
    { "robots.txt": "Content-Signal: search=yes, ai-input=yes\nSitemap: https://huvudkontoret.io/sitemap.xml\n" },
    "published position on model training",
  );
});

test("publishing: a committed build directory is a finding", () => {
  assertFires(publishing, { "dist/index.html": "<!doctype html>\n" }, "must never be committed");
});

test("markup: an unclosed element is a finding", () => {
  assertFires(markup, { "index.html": baseline()["index.html"].replace("<body>", "<body><div>") }, "never closed");
});

test("markup: an image without alt is a finding", () => {
  assertFires(markup, { "index.html": baseline()["index.html"].replace(' alt="Logotyp"', "") }, "has no alt");
});

test("markup: two titles are a finding", () => {
  assertFires(markup, { "index.html": baseline()["index.html"].replace("</head>", "<title>Igen</title></head>") }, "there must be exactly one");
});

test("markup: a missing lang attribute is a finding", () => {
  assertFires(markup, { "index.html": baseline()["index.html"].replace('<html lang="sv">', "<html>") }, "no lang attribute");
});

test("markup: a missing doctype is a finding", () => {
  assertFires(markup, { "index.html": baseline()["index.html"].replace("<!doctype html>\n", "") }, "quirks mode");
});

test("markup: optional end tags are not treated as unclosed", () => {
  // <p> and <li> legally omit their end tag; flagging them would make the gate
  // wrong about hand-written markup.
  assertClean(markup, {
    "index.html": baseline()["index.html"].replace("</body>", "<ul><li>ett<li>två</ul><p>text</body>"),
  });
});

test("formatting: trailing whitespace, tabs and CRLF are findings", () => {
  assertFires(formatting, { "index.md": "# Titel   \n" }, "trailing whitespace");
  assertFires(formatting, { "index.md": "# Titel\n\ttext\n" }, "indented with a tab");
  assertFires(formatting, { "index.md": "# Titel\r\n" }, "must be LF");
  assertFires(formatting, { "index.md": "# Titel" }, "no final newline");
});

test("formatting: exported assets are exempt", () => {
  // Re-exporting a logo from a drawing program must not break the build.
  assertClean(formatting, { "assets/logo.svg": "<svg>\r\n\t<path/>\r\n</svg>" });
});
