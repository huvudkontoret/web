#!/usr/bin/env node
/**
 * The gate for the static site.
 *
 * Run by `hk verify web` locally and by .github/workflows/pr.yml on every pull
 * request — the same command in both places, so a green PR means what it says.
 * No dependencies: the site has no build step and this should not give it one.
 *
 *   node tools/check/run.mjs            content checks (hk "test")
 *   node tools/check/run.mjs --format   .editorconfig conformance (hk "lint")
 *   node tools/check/run.mjs --json     machine-readable, per workspace convention
 *
 * Exit codes follow hk: 0 ok, 1 findings, 2 usage error.
 */

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import * as analytics from "./checks/analytics.mjs";
import * as fonts from "./checks/fonts.mjs";
import * as formatting from "./checks/formatting.mjs";
import * as markup from "./checks/markup.mjs";
import * as profile from "./checks/profile.mjs";
import * as publishing from "./checks/publishing.mjs";
import * as references from "./checks/references.mjs";
import * as sitemap from "./checks/sitemap.mjs";
import * as surfaces from "./checks/surfaces.mjs";
import * as workers from "./checks/workers.mjs";
import { loadSite } from "./lib/site.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..");

const CONTENT_CHECKS = [publishing, workers, references, sitemap, markup, surfaces, profile, fonts, analytics];
const FORMAT_CHECKS = [formatting];

function parseArguments(argv) {
  const options = { format: false, json: false, root: ROOT };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--format") options.format = true;
    else if (argument === "--json") options.json = true;
    else if (argument === "-h" || argument === "--help") options.help = true;
    // Check a different checkout of this repo — the same idea as
    // `hk verify --worktree`, and how this gate is tested against a branch.
    else if (argument === "--root") {
      const value = argv[index + 1];
      if (!value) {
        process.stderr.write("check: --root needs a directory\n");
        process.exit(2);
      }
      options.root = resolve(value);
      index += 1;
    } else {
      process.stderr.write(`check: unknown argument '${argument}'\n`);
      process.exit(2);
    }
  }
  return options;
}

function createReport() {
  const findings = [];
  return {
    findings,
    forCheck(check) {
      return {
        fail(where, message) {
          findings.push({ check: check.name, where, message });
        },
      };
    },
  };
}

/** `path:line` splits into a GitHub annotation; anything else is just a label. */
function annotate(finding) {
  const match = /^(.*?):(\d+)$/.exec(finding.where);
  const file = match ? match[1] : finding.where;
  const line = match ? `,line=${match[2]}` : "";
  const message = finding.message.replace(/\r?\n/g, " ");
  return `::error file=${file}${line},title=${finding.check}::${message}`;
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(readFileSync(join(HERE, "README.md"), "utf8"));
    return 0;
  }

  const facts = JSON.parse(readFileSync(join(HERE, "facts.json"), "utf8"));
  const site = loadSite(options.root);
  const checks = options.format ? FORMAT_CHECKS : CONTENT_CHECKS;
  const report = createReport();

  for (const check of checks) {
    check.run(site, facts, report.forCheck(check));
  }

  const { findings } = report;

  if (options.json) {
    process.stdout.write(
      `${JSON.stringify(
        {
          ok: findings.length === 0,
          checks: checks.map((check) => ({
            name: check.name,
            summary: check.summary,
            findings: findings.filter((finding) => finding.check === check.name).length,
          })),
          findings,
        },
        null,
        2,
      )}\n`,
    );
    return findings.length === 0 ? 0 : 1;
  }

  for (const check of checks) {
    const own = findings.filter((finding) => finding.check === check.name);
    const mark = own.length === 0 ? "ok  " : "FAIL";
    process.stdout.write(`${mark}  ${check.name} — ${check.summary}\n`);
    for (const finding of own) {
      process.stdout.write(`        ${finding.where}\n          ${finding.message}\n`);
    }
  }

  if (process.env.GITHUB_ACTIONS) {
    for (const finding of findings) process.stdout.write(`${annotate(finding)}\n`);
  }

  process.stdout.write(
    findings.length === 0
      ? `\n${checks.length} checks passed\n`
      : `\n${findings.length} finding(s) across ${new Set(findings.map((f) => f.check)).size} check(s)\n`,
  );
  return findings.length === 0 ? 0 : 1;
}

process.exit(main());
