#!/usr/bin/env node
/**
 * The gate for what actually lands on main.
 *
 * This repo squash-merges one pull request per slice, so the pull request
 * *title* — not the commits inside the branch — becomes the commit subject on
 * `main`. Conventional commits is a workspace convention, but until now it
 * lived only as prose in `hk context`, which is why this repo's own history
 * spells it several different ways.
 *
 * Run from .github/workflows/pr.yml, inside the same `verify` job the branch
 * ruleset already requires, so no ruleset change is needed to make it binding.
 *
 *   node tools/check/title.mjs "feat(deploy): serve huvudkontoret.io from the Worker"
 *
 * Exit codes follow hk: 0 ok, 1 findings, 2 usage error.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

const SUBJECT = /^(?<type>[a-z]+)(?:\((?<scope>[a-z0-9][a-z0-9._/-]*)\))?(?<breaking>!)?: (?<description>.+)$/;

/**
 * Findings for one subject line, as plain strings.
 *
 * Deliberately not asserted: the case of the first word. "MonoLisa", "GitHub
 * Pages" and "Cloudflare" all open subjects legitimately in this repo, and a
 * lowercase rule would fail them — a gate that cries wolf is a gate someone
 * switches off.
 */
export function checkTitle(title, facts) {
  const findings = [];

  if (typeof title !== "string" || title.trim() === "") {
    return ["is empty — it becomes the commit subject on main, so it cannot be blank"];
  }
  if (title !== title.trim()) {
    findings.push("has leading or trailing whitespace");
  }

  const match = SUBJECT.exec(title.trim());
  if (!match) {
    return [
      ...findings,
      `is not a conventional commit subject: expected "type(optional-scope): description", ` +
        `got ${JSON.stringify(title)}. Types: ${facts.commitTypes.join(", ")}.`,
    ];
  }

  const { type, description } = match.groups;

  if (!facts.commitTypes.includes(type)) {
    findings.push(`uses the type "${type}", which is not one of: ${facts.commitTypes.join(", ")}`);
  }
  if (description !== description.trim()) {
    findings.push("has padding around the description");
  }
  if (description.trim().endsWith(".")) {
    findings.push("ends in a period — a commit subject is a title, not a sentence");
  }
  if (title.trim().length > facts.titleMaxLength) {
    findings.push(
      `is ${title.trim().length} characters, over the ${facts.titleMaxLength} a subject line should keep to. ` +
        "The detail belongs in the body, which squash-merge takes from the description.",
    );
  }

  return findings;
}

function main(argv) {
  if (argv.length !== 1) {
    process.stderr.write('title: expected exactly one argument, the subject line\n');
    return 2;
  }

  const facts = JSON.parse(readFileSync(join(HERE, "facts.json"), "utf8"));
  const findings = checkTitle(argv[0], facts);

  if (findings.length === 0) {
    process.stdout.write(`ok    title — ${argv[0]}\n`);
    return 0;
  }

  process.stdout.write(`FAIL  title — the pull request title becomes the commit subject on main\n`);
  for (const finding of findings) {
    process.stdout.write(`        ${finding}\n`);
    if (process.env.GITHUB_ACTIONS) {
      process.stdout.write(`::error title=title::The pull request title ${finding.replace(/\r?\n/g, " ")}\n`);
    }
  }
  return 1;
}

// Importable for the gate's own tests; only the direct run exits.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
