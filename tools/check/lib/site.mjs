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

/**
 * The site's public origin, without a trailing slash.
 *
 * Read from the CNAME file until 2026-08-26, which was GitHub Pages' way of
 * naming the custom domain. The Worker takes its hostname from
 * `wrangler.jsonc` instead, so the origin is now a stated fact rather than a
 * file left over from another host.
 */
export function origin(facts) {
  return facts.apexHostname ? `https://${facts.apexHostname}` : null;
}

/**
 * The URL a page is served at, without the origin.
 *
 * Workers static assets default to `html_handling: auto-trailing-slash`, so
 * `profil.html` answers at `/profil` and a request for `/profil.html` is
 * redirected there. The canonical address is therefore the one without the
 * extension, and `index.html` is the root. The gate has to know this rule in
 * both directions: to read a `<loc>` back to a file, and to say which URL a
 * file should be advertised under.
 */
export function pagePath(page) {
  if (page === "index.html") return "/";
  if (page.endsWith("/index.html")) return `/${page.slice(0, -"index.html".length)}`;
  if (page.endsWith(".html")) return `/${page.slice(0, -".html".length)}`;
  return `/${page}`;
}

/**
 * Map a URL found in the markup to the repo path it must resolve to, or null
 * when it is not ours to check (external host, mailto:, #anchor, data:).
 */
export function toRepoPath(url, site, facts) {
  const value = url.trim();
  if (!value || value.startsWith("#")) return null;
  if (/^(mailto|tel|data|javascript|blob):/i.test(value)) return null;

  const site_origin = origin(facts);
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
  // `/profil` is `profil.html` under the Worker's html_handling (see
  // pagePath). Only when no file of the bare name exists — a directory or
  // an extensionless file would otherwise be shadowed by a sibling page.
  if (!path.split("/").pop().includes(".") && !site.has(path) && site.has(`${path}.html`)) {
    return `${path}.html`;
  }
  return path;
}
