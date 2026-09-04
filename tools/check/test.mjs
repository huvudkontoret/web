/**
 * Tests for the gate itself.
 *
 * A gate nobody has tried to break is just a green tick. Each case seeds a
 * throwaway git repo, introduces exactly one defect, and asserts the check
 * notices — plus the cases that must NOT fire, which are the ones that would
 * otherwise make the gate untrustworthy and get switched off.
 *
 *   node --test tools/check/test.mjs
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
import * as profile from "./checks/profile.mjs";
import * as publishing from "./checks/publishing.mjs";
import * as references from "./checks/references.mjs";
import * as sitemap from "./checks/sitemap.mjs";
import * as surfaces from "./checks/surfaces.mjs";
import * as workers from "./checks/workers.mjs";
import { checkTitle } from "./title.mjs";
import { loadSite } from "./lib/site.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const FACTS = JSON.parse(readFileSync(join(HERE, "facts.json"), "utf8"));

const TEAM = "Hanna Wikman, Magnus Renholm, Sebastian Berglönn";
const CONTACT = "hej@huvudkontoret.io";

/** A sitemap advertising exactly `paths`, each rooted at the fixture's origin. */
function sitemapListing(paths) {
  const entries = paths.map((path) => `  <url><loc>https://huvudkontoret.io${path}</loc></url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset>\n${entries}\n</urlset>\n`;
}

/** A minimal site that passes every check — the baseline each case perturbs. */
function baseline() {
  return {
    ".gitignore": "assets/fonts/*.woff2\n",
    "index.html": [
      "<!doctype html>",
      '<html lang="sv">',
      "<head><title>Huvudkontoret</title>",
      "<style>",
      ":root { --black: #16150f; --signal: #d9481c; }",
      // A responsive override is not a disagreement about the profile, and
      // the real index.html has one. The check must look past it.
      "@media (max-width: 640px) { :root { --gut: 20px; } }",
      "</style>",
      "</head>",
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
    // The baseline carries index.html, index.md and llms.txt, so those are the
    // pages the sitemap check expects it to advertise.
    "sitemap.xml": sitemapListing(["/", "/index.md", "/llms.txt"]),
    "assets/logo.svg": '<svg xmlns="http://www.w3.org/2000/svg"></svg>\n',
    "src/styles/profile.css": ":root {\n  --black: #16150f;\n  --signal: #d9481c;\n}\n",
    "wrangler.jsonc": [
      "{",
      '  // The site is the repo root; https://example.com/ in a comment must not confuse the parser.',
      '  "name": "web",',
      '  "assets": { "directory": "." },',
      '  "routes": [{ "pattern": "huvudkontoret.io", "custom_domain": true }],',
      '  "preview_urls": true,',
      "}",
      "",
    ].join("\n"),
    ".assetsignore": ".assetsignore\n.gitignore\nwrangler.jsonc\nsrc/\nassets/fonts/*.woff2\n.git/\n.wrangler/\nnode_modules/\n",
  };
}

const fixtures = [];
after(() => {
  for (const dir of fixtures) rmSync(dir, { recursive: true, force: true });
});

/** A throwaway git repo holding `files`. */
function fixtureRoot(files) {
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
  return root;
}

/** Findings from one check against a site built from `files`. */
function findings(check, files, facts = FACTS) {
  const collected = [];
  check.run(loadSite(fixtureRoot(files)), facts, {
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
  for (const check of [publishing, workers, references, sitemap, markup, surfaces, profile, fonts, formatting]) {
    assertClean(check);
  }
});

/**
 * The profile is declared twice by decision (ADR 0004), so these are the cases
 * that make the duplication safe. A check that only ever agreed with itself
 * would be worth nothing.
 */

test("profile: a property with a different value in each place is a finding", () => {
  assertFires(
    profile,
    { "src/styles/profile.css": ":root {\n  --black: #16150f;\n  --signal: #ff0000;\n}\n" },
    'is "#ff0000" here and "#d9481c" in index.html',
  );
});

test("profile: a property the page declares and the stylesheet does not is a finding", () => {
  assertFires(
    profile,
    { "src/styles/profile.css": ":root {\n  --black: #16150f;\n}\n" },
    "--signal is declared in index.html but not here",
  );
});

test("profile: a property invented in the stylesheet is a finding", () => {
  assertFires(
    profile,
    { "src/styles/profile.css": ":root {\n  --black: #16150f;\n  --signal: #d9481c;\n  --invented: 1px;\n}\n" },
    "--invented is declared here but not in index.html",
  );
});

test("profile: deleting the stylesheet does not silently switch the check off", () => {
  assertFires(profile, { "src/styles/profile.css": null }, "the shared profile stylesheet is missing");
});

test("profile: a page with no :root block at all is a finding, not a pass", () => {
  assertFires(
    profile,
    { "index.html": baseline()["index.html"].replace(/<style>[\s\S]*?<\/style>/, "") },
    "no top-level :root block found",
  );
});

/**
 * The two that must NOT fire. `--gut` lives only inside a media query in the
 * baseline page; treating that as a missing property would make the check fire
 * on every responsive rule the profile has, which is how a check gets switched
 * off rather than fixed.
 */
test("profile: a :root inside a media query is not part of the contact surface", () => {
  assertClean(profile);
});

test("profile: reformatting a value does not count as disagreement", () => {
  assertClean(profile, {
    "src/styles/profile.css": ":root {\n  --black:   #16150f;\n  --signal:\n    #d9481c;\n}\n",
  });
});

test("workers: a file that is neither ignored nor part of the site is a finding", () => {
  assertFires(workers, { "NOTES.md": "internal\n" }, "would be served from the site but is not part of it");
});

test("workers: excluding a surface the agents depend on is a finding", () => {
  assertFires(workers, { ".assetsignore": `${baseline()[".assetsignore"]}llms.txt\n` }, "agent surfaces depend on");
});

test("workers: a missing .assetsignore is a finding", () => {
  assertFires(workers, { ".assetsignore": null }, "entire repo root would be served");
});

test("workers: a pattern the gate cannot read is a finding, not a guess", () => {
  // Silently treating an unreadable pattern as "matches nothing" would wave
  // through a file everyone believed was excluded.
  assertFires(workers, { ".assetsignore": `${baseline()[".assetsignore"]}!docs/**\n` }, "syntax this gate does not read");
});

/** wrangler.jsonc with the apex route taken out — the site before the cutover. */
function withoutCutoverRoute() {
  return baseline()["wrangler.jsonc"].replace(
    '  "routes": [{ "pattern": "huvudkontoret.io", "custom_domain": true }],\n',
    "",
  );
}

test("workers: the custom domain arriving before the decision is a finding", () => {
  // `wrangler deploy` creates the domain it finds in config, so a route moves
  // its apex off whatever serves it today. The cutover for huvudkontoret.io is
  // taken, but the guard is what keeps the next domain's from arriving as a
  // side effect, so it is asserted against facts that have not decided yet.
  const undecided = { ...FACTS, expectCustomDomain: false };

  const found = findings(workers, withEdits({}), undecided);
  assert.ok(
    found.some((finding) => finding.message.includes("performs the cutover on the next production deploy")),
    `expected a premature-cutover finding, got: ${JSON.stringify(found, null, 2)}`,
  );
});

test("workers: with the decision recorded, the route is required and cannot go missing", () => {
  const missing = findings(workers, withEdits({ "wrangler.jsonc": withoutCutoverRoute() }));
  assert.ok(
    missing.some((finding) => finding.message.includes("no custom_domain route for huvudkontoret.io")),
    `expected a missing-domain finding, got: ${JSON.stringify(missing, null, 2)}`,
  );

  // And the config that performs it passes — the baseline carries the route.
  assertClean(workers);
});

test("workers: dropping .git/ from .assetsignore is a finding", () => {
  // The case the gate could not see before: git never tracks .git/, so the
  // published set — derived from tracked files — says nothing about it, while
  // wrangler uploads it with everything else in the directory.
  assertFires(
    workers,
    { ".assetsignore": baseline()[".assetsignore"].replace(".git/\n", "") },
    "does not exclude .git/",
  );
});

test("workers: every always-ignored path is asserted, not just the first", () => {
  assertFires(
    workers,
    { ".assetsignore": baseline()[".assetsignore"].replace(".wrangler/\n", "") },
    "does not exclude .wrangler/",
  );
});

test("workers: preview_urls off is a finding", () => {
  assertFires(
    workers,
    { "wrangler.jsonc": baseline()["wrangler.jsonc"].replace('"preview_urls": true', '"preview_urls": false') },
    "preview_urls is not true",
  );
});

test("workers: a wrangler config that does not parse is a finding", () => {
  assertFires(workers, { "wrangler.jsonc": "{ oops\n" }, "does not parse");
});

test("workers: the licensed fonts must be excluded from upload while they are gitignored", () => {
  // wrangler uploads the working directory, so .gitignore alone does not stop
  // a local deploy from publishing MonoLisa. Dropping only the .assetsignore
  // half quietly reopens that path.
  assertFires(
    workers,
    { ".assetsignore": baseline()[".assetsignore"].replace("assets/fonts/*.woff2\n", "") },
    "a local deploy would publish the licensed fonts",
  );
});

test("workers: once the licence lands, dropping both rules together is fine", () => {
  assertClean(workers, {
    ".gitignore": "node_modules/\n",
    ".assetsignore": baseline()[".assetsignore"].replace("assets/fonts/*.woff2\n", ""),
  });
});

/** The subject line that lands on main, since the repo squash-merges. */
function titleFindings(title) {
  return checkTitle(title, FACTS);
}

test("title: a conventional subject passes, with and without a scope", () => {
  assert.deepEqual(titleFindings("feat(deploy): serve huvudkontoret.io from the Worker"), []);
  assert.deepEqual(titleFindings("docs: replace the Astro starter README with the real one"), []);
  assert.deepEqual(titleFindings("feat(check)!: drop the Pages assertions"), []);
});

test("title: a subject with no type is a finding", () => {
  // The shape this repo's own history keeps slipping into.
  const found = titleFindings("The TLD workspace: the registry, the Worker, and the decision behind them");
  assert.ok(found.some((finding) => finding.includes("not a conventional commit subject")), found.join("; "));
});

test("title: an invented type is a finding", () => {
  const found = titleFindings("improve(check): tighten the gate");
  assert.ok(found.some((finding) => finding.includes('uses the type "improve"')), found.join("; "));
});

test("title: a trailing period and an overlong subject are findings", () => {
  assert.ok(titleFindings("fix(sitemap): advertise every surface.").some((f) => f.includes("ends in a period")));
  const long = `feat(check): ${"x".repeat(FACTS.titleMaxLength)}`;
  assert.ok(titleFindings(long).some((finding) => finding.includes("over the")), "expected a length finding");
});

test("title: an empty subject is a finding rather than a pass", () => {
  // The workflow passes whatever GitHub hands it; an empty string must not
  // read as "nothing to complain about".
  assert.ok(titleFindings("").length > 0);
  assert.ok(titleFindings("   ").length > 0);
});

test("title: case is deliberately not asserted", () => {
  // "MonoLisa" and "GitHub Pages" open subjects legitimately in this repo.
  assert.deepEqual(titleFindings("fix(fonts): MonoLisa must never reach the site"), []);
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

test("sitemap: an entry pointing at nothing is a finding", () => {
  assertFires(
    sitemap,
    { "sitemap.xml": '<urlset><url><loc>https://huvudkontoret.io/nope.html</loc></url></urlset>\n' },
    "nope.html",
  );
});

test("sitemap: a published page with no entry is a finding", () => {
  // The quiet direction. Nothing 404s, nothing complains — the page is simply
  // never found, and robots.txt points crawlers at this file and nowhere else.
  assertFires(sitemap, { "sitemap.xml": sitemapListing(["/"]) }, "index.md is published but has no <loc>");
});

test("sitemap: reaching a page by a non-canonical URL is a finding", () => {
  // Not a missing page: the same page advertised under two addresses.
  assertFires(
    sitemap,
    { "sitemap.xml": sitemapListing(["/index.html", "/index.md", "/llms.txt"]) },
    "non-canonical URL",
  );
});

test("sitemap: advertising something that is not a page is a finding", () => {
  assertFires(
    sitemap,
    { "sitemap.xml": sitemapListing(["/", "/index.md", "/llms.txt", "/assets/logo.svg"]) },
    "which is not one of the site's pages",
  );
});

test("sitemap: a declared page absent from this checkout is not a finding", () => {
  // facts.json describes the site, not every branch of it. A checkout
  // mid-change must not be told to advertise a file it does not have —
  // `workers` owns the question of which files are required.
  assertClean(sitemap);
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

// The regression: Nok.otf and Nok.ttf sat directly in assets/ and the check
// stayed green, because the pattern named one directory and one format.
test("fonts: a font binary outside assets/fonts is a finding too", () => {
  assertFires(fonts, { "assets/Nok.otf": "not really a font" }, "would publish it");
  assertFires(fonts, { "assets/Nok.ttf": "not really a font" }, "would publish it");
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

test("surfaces: a section heading repeated in one surface is a finding", () => {
  // Exactly what a clean merge produces when two branches each add "## Team".
  assertFires(
    surfaces,
    { "llms.txt": `${baseline()["llms.txt"]}\n## Team\n\n${TEAM}\n\n## Team\n\n${TEAM}\n` },
    "is already a section at line",
  );
});

test("surfaces: the same heading in two different surfaces is fine", () => {
  assertClean(surfaces, {
    "index.md": `${baseline()["index.md"]}\n## Kontakt\n\n${CONTACT}\n`,
    "llms.txt": `${baseline()["llms.txt"]}\n## Kontakt\n\n${CONTACT}\n`,
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

test("publishing: a missing required surface is a finding", () => {
  assertFires(publishing, { "llms.txt": null }, "required at the repo root");
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
