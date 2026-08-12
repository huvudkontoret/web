/**
 * The site as the gate sees it: the repo root, the files git actually tracks,
 * and cached reads.
 *
 * Tracked files matter more than files on disk. A push to `main` publishes
 * this repo, so "does this exist" has to mean "does this exist for everyone
 * else" — a reference that only resolves on the author's machine is exactly
 * the failure this gate is here to catch.
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export function loadSite(root) {
  const cache = new Map();

  const tracked = new Set(
    execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 })
      .split("\0")
      .filter(Boolean),
  );

  function read(relativePath) {
    if (!cache.has(relativePath)) {
      try {
        cache.set(relativePath, readFileSync(join(root, relativePath), "utf8"));
      } catch {
        cache.set(relativePath, null);
      }
    }
    return cache.get(relativePath);
  }

  return {
    root,
    tracked,
    read,
    /** Tracked, not merely present on disk. */
    has: (relativePath) => tracked.has(relativePath),
    trackedMatching: (pattern) => [...tracked].filter((file) => pattern.test(file)),
  };
}

/** The site's public origin, from CNAME, without a trailing slash. */
export function origin(site) {
  const cname = (site.read("CNAME") ?? "").trim();
  return cname ? `https://${cname}` : null;
}

/**
 * Map a URL found in the markup to the repo path it must resolve to, or null
 * when it is not ours to check (external host, mailto:, #anchor, data:).
 */
export function toRepoPath(url, site) {
  const value = url.trim();
  if (!value || value.startsWith("#")) return null;
  if (/^(mailto|tel|data|javascript|blob):/i.test(value)) return null;

  const site_origin = origin(site);
  let path = null;

  if (/^https?:\/\//i.test(value) || value.startsWith("//")) {
    const absolute = value.startsWith("//") ? `https:${value}` : value;
    let parsed;
    try {
      parsed = new URL(absolute);
    } catch {
      return null;
    }
    if (!site_origin || parsed.origin !== site_origin) return null;
    path = parsed.pathname;
  } else {
    path = value.split("#")[0].split("?")[0];
    if (!path) return null;
  }

  path = path.split("#")[0].split("?")[0];
  path = path.replace(/^\.\//, "").replace(/^\//, "");
  if (!path) path = "index.html";
  // A directory URL is served by its index.html.
  if (path.endsWith("/")) path += "index.html";

  try {
    path = decodeURIComponent(path);
  } catch {
    // A URL that will not decode is a finding for the caller, not a crash.
  }
  return path;
}
