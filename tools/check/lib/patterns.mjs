/**
 * A deliberately small subset of gitignore syntax, used to work out what
 * `.assetsignore` actually publishes.
 *
 * Only four shapes are understood:
 *
 *   name          exact path, or a file of that name in the root
 *   dir/          that directory and everything under it
 *   *.ext         any file with that extension, at any depth
 *   dir/*.ext     that extension directly inside that directory
 *
 * Anything else — negation, `**`, character classes, `?` — is reported as
 * unsupported rather than guessed at. Half-understanding the file that decides
 * what reaches production is worse than admitting the limit: a pattern this
 * cannot read would otherwise be silently treated as "matches nothing", and
 * the gate would wave through a file it believed was excluded.
 */

const UNSUPPORTED = /[!\[\]?]|\*\*/;

export function parsePatterns(text) {
  const patterns = [];
  const unsupported = [];

  (text ?? "").split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) return;
    if (UNSUPPORTED.test(line)) {
      unsupported.push({ line, number: index + 1 });
      return;
    }
    patterns.push({ line, number: index + 1 });
  });

  return { patterns, unsupported };
}

/** Does one pattern cover this repo-relative path? */
export function matches(pattern, path) {
  const value = pattern.replace(/^\.\//, "");

  if (value.endsWith("/")) {
    const directory = value.slice(0, -1);
    return path === directory || path.startsWith(`${directory}/`);
  }

  const star = value.indexOf("*");
  if (star !== -1) {
    const prefix = value.slice(0, star);
    const suffix = value.slice(star + 1);
    if (prefix === "") {
      // `*.ext` applies at any depth, the way gitignore treats a bare pattern.
      return path.endsWith(suffix);
    }
    return path.startsWith(prefix) && path.endsWith(suffix) && !path.slice(prefix.length).includes("/");
  }

  if (path === value) return true;
  // A bare name with no slash matches that name in any directory.
  if (!value.includes("/")) return path.split("/").pop() === value;
  return false;
}

export function matchesAny(patterns, path) {
  return patterns.some((pattern) => matches(pattern.line ?? pattern, path));
}
