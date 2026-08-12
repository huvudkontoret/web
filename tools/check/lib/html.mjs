/**
 * Just enough HTML reading for the static site's checks — no dependencies.
 *
 * This is deliberately not a parser. It answers the handful of questions the
 * gate asks (what does this page reference, which ids does it define, are the
 * structural tags balanced) and nothing else. Anything needing a real DOM
 * belongs in a different tool, not here.
 */

/** Elements that never have an end tag. */
const VOID_ELEMENTS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

/**
 * Elements whose end tag HTML allows you to omit. Balance is not checkable for
 * these without a full parser, so the gate does not try — a false failure on
 * hand-written markup is worse than the miss.
 */
const OPTIONAL_END_TAG = new Set([
  "p",
  "li",
  "dt",
  "dd",
  "tr",
  "td",
  "th",
  "thead",
  "tbody",
  "tfoot",
  "caption",
  "colgroup",
  "option",
  "optgroup",
  "rt",
  "rp",
]);

/** Strip comments and the raw-text elements, keeping byte offsets stable. */
export function stripRawText(html) {
  const blank = (match) => match.replace(/[^\n]/g, " ");
  return html
    .replace(/<!--[\s\S]*?-->/g, blank)
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, blank)
    .replace(/<style\b[\s\S]*?<\/style\s*>/gi, blank);
}

/** 1-based line number for a byte offset. */
export function lineAt(text, index) {
  let line = 1;
  for (let i = 0; i < index && i < text.length; i += 1) {
    if (text[i] === "\n") line += 1;
  }
  return line;
}

const TAG = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;

/**
 * Every tag in document order: name, whether it closes, its raw attribute
 * text, and where it starts.
 */
export function tags(html) {
  const found = [];
  for (const match of html.matchAll(TAG)) {
    found.push({
      name: match[2].toLowerCase(),
      closing: match[1] === "/",
      selfClosing: /\/\s*$/.test(match[3] ?? ""),
      attrs: match[3] ?? "",
      index: match.index,
    });
  }
  return found;
}

const ATTR = /([a-zA-Z_:][a-zA-Z0-9_.:-]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;

/** Attributes of a tag as a plain object, lower-cased names. */
export function attributes(raw) {
  const out = {};
  for (const match of raw.matchAll(ATTR)) {
    out[match[1].toLowerCase()] = match[3] ?? match[4] ?? match[5] ?? "";
  }
  return out;
}

/**
 * Structural tags that are opened and never closed, or closed and never
 * opened. Elements with optional end tags are skipped by design.
 */
export function unbalanced(html) {
  const stack = [];
  const issues = [];
  for (const tag of tags(html)) {
    if (VOID_ELEMENTS.has(tag.name) || OPTIONAL_END_TAG.has(tag.name)) continue;
    if (tag.selfClosing) continue;
    if (tag.closing) {
      const openIndex = stack.findLastIndex((open) => open.name === tag.name);
      if (openIndex === -1) {
        issues.push({ kind: "unopened", name: tag.name, index: tag.index });
        continue;
      }
      for (const skipped of stack.splice(openIndex + 1)) {
        issues.push({ kind: "unclosed", name: skipped.name, index: skipped.index });
      }
      stack.pop();
    } else {
      stack.push(tag);
    }
  }
  for (const open of stack) {
    issues.push({ kind: "unclosed", name: open.name, index: open.index });
  }
  return issues;
}

/** Every `id` attribute value, with the offset it was defined at. */
export function ids(html) {
  const found = [];
  for (const tag of tags(html)) {
    if (tag.closing) continue;
    const id = attributes(tag.attrs).id;
    if (id) found.push({ id, index: tag.index });
  }
  return found;
}

/**
 * Every URL the page points at: element attributes, `<meta content>` when it
 * looks like a URL, and CSS `url(...)` in inline styles and style blocks.
 */
export function references(html) {
  const found = [];
  const urlAttributes = ["href", "src", "poster", "data-src"];

  for (const tag of tags(html)) {
    if (tag.closing) continue;
    const attrs = attributes(tag.attrs);
    for (const name of urlAttributes) {
      if (attrs[name]) found.push({ url: attrs[name], from: `<${tag.name} ${name}>`, index: tag.index });
    }
    if (attrs.srcset) {
      for (const candidate of attrs.srcset.split(",")) {
        const url = candidate.trim().split(/\s+/)[0];
        if (url) found.push({ url, from: `<${tag.name} srcset>`, index: tag.index });
      }
    }
    // og:image and friends carry URLs in `content`; other meta tags do not.
    if (tag.name === "meta" && attrs.content && /^(https?:)?\/\/|^\.{0,2}\//.test(attrs.content)) {
      found.push({ url: attrs.content, from: `<meta ${attrs.property ?? attrs.name ?? "content"}>`, index: tag.index });
    }
  }

  for (const match of html.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s]*))\s*\)/g)) {
    const url = match[1] ?? match[2] ?? match[3] ?? "";
    if (url) found.push({ url, from: "css url()", index: match.index });
  }

  return found;
}

export { VOID_ELEMENTS, OPTIONAL_END_TAG };
