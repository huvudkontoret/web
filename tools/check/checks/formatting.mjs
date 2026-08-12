/**
 * The repo's formatting contract is .editorconfig, and this enforces exactly
 * what it declares: UTF-8, LF, a final newline, no trailing whitespace, spaces
 * for indentation.
 *
 * It deliberately does not reflow anything. index.html is hand-written and
 * design-sensitive; a formatter's opinion about line breaks is not a defect,
 * and rewriting the page would be a change to the product rather than a gate
 * on it.
 */

import { readFileSync } from "node:fs";
import { extname, join } from "node:path";

export const name = "formatting";
export const summary = ".editorconfig is respected";

export function run(site, facts, report) {
  const extensions = new Set(facts.textFileExtensions);
  // assets/ holds exported and vendored artifacts — logos out of a drawing
  // program, Lottie JSON, minified libraries. They are not written by hand, so
  // holding them to an editing convention would only mean that re-exporting
  // the logo breaks the build.
  const ignored = facts.formattingIgnore.map((pattern) => new RegExp(pattern));

  for (const file of [...site.tracked].sort()) {
    if (!extensions.has(extname(file).toLowerCase())) continue;
    if (ignored.some((pattern) => pattern.test(file))) continue;

    let bytes;
    try {
      bytes = readFileSync(join(site.root, file));
    } catch {
      continue;
    }

    const text = bytes.toString("utf8");
    // A lossless round-trip is the practical test for "is this valid UTF-8".
    if (!Buffer.from(text, "utf8").equals(bytes)) {
      report.fail(file, "is not valid UTF-8 (.editorconfig: charset = utf-8)");
      continue;
    }
    if (text === "") continue;

    if (text.includes("\r")) {
      report.fail(file, "contains CR — line endings must be LF (.editorconfig: end_of_line = lf)");
    }
    if (!text.endsWith("\n")) {
      report.fail(file, "has no final newline (.editorconfig: insert_final_newline = true)");
    }

    text.split("\n").forEach((line, index) => {
      if (/[ \t]+$/.test(line)) {
        report.fail(`${file}:${index + 1}`, "trailing whitespace (.editorconfig: trim_trailing_whitespace = true)");
      }
      if (/^\t/.test(line)) {
        report.fail(`${file}:${index + 1}`, "indented with a tab (.editorconfig: indent_style = space)");
      }
    });
  }
}
