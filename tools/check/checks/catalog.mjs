/** Validate the catalog's Linkset structure and its locally published targets. */
import { toRepoPath } from "../lib/site.mjs";
import { matchesAny, parsePatterns } from "../lib/patterns.mjs";

export const name = "catalog";
export const summary = "the API catalog uses Linkset JSON and points at published resources";

export function run(site, facts, report) {
  const [canonical, ...aliases] = facts.apiCatalogPaths;
  const text = site.read(canonical);
  if (text === null || !site.has(canonical)) {
    report.fail(canonical, "missing tracked API catalog");
    return;
  }
  for (const alias of aliases) {
    if (!site.has(alias) || site.read(alias) !== text) report.fail(alias, `must match ${canonical}`);
  }
  let catalog;
  try {
    catalog = JSON.parse(text);
  } catch {
    report.fail(canonical, "invalid JSON");
    return;
  }
  if (!object(catalog) || Object.keys(catalog).length !== 1 || !Array.isArray(catalog.linkset)) {
    report.fail(canonical, "must contain only a top-level linkset array (RFC 9264)");
    return;
  }
  const { patterns } = parsePatterns(site.read(".assetsignore") ?? "");
  function checkUrl(value) {
    try {
      if (typeof value !== "string" || new URL(value).protocol !== "https:") throw new Error();
    } catch {
      report.fail(canonical, "anchor and href must be absolute HTTPS URLs");
      return;
    }
    const path = toRepoPath(value, site, facts);
    if (path && (!site.has(path) || matchesAny(patterns, path) || !matchesAny(facts.publishedPaths, path))) {
      report.fail(canonical, `${value} does not resolve to a tracked, published resource`);
    }
  }
  for (const context of catalog.linkset) {
    if (!object(context)) {
      report.fail(canonical, "each linkset entry must be an object");
      continue;
    }
    checkUrl(context.anchor);
    for (const [relation, targets] of Object.entries(context)) {
      if (relation === "anchor") continue;
      if (!facts.apiCatalogRelations.includes(relation)) {
        report.fail(canonical, `undeclared relation ${relation}; use a registered relation with the correct meaning`);
      }
      if (!Array.isArray(targets) || targets.length === 0) {
        report.fail(canonical, `${relation} must contain an array of link targets`);
        continue;
      }
      for (const target of targets) {
        checkUrl(object(target) ? target.href : undefined);
        if (object(target) && target.type !== undefined && typeof target.type !== "string") {
          report.fail(canonical, "link target type must be a string");
        }
      }
    }
  }
}

function object(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
