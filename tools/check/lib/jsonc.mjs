/**
 * JSON with comments, which is what wrangler.jsonc is.
 *
 * A regex would corrupt any `//` living inside a string — and this file is
 * full of URLs — so the comment stripper walks the text instead. Comments are
 * replaced by spaces so offsets stay usable for error messages.
 */

export function parseJsonc(text) {
  let out = "";
  let index = 0;

  while (index < text.length) {
    const char = text[index];

    if (char === '"') {
      const start = index;
      index += 1;
      while (index < text.length) {
        if (text[index] === "\\") {
          index += 2;
          continue;
        }
        if (text[index] === '"') {
          index += 1;
          break;
        }
        index += 1;
      }
      out += text.slice(start, index);
      continue;
    }

    if (char === "/" && text[index + 1] === "/") {
      while (index < text.length && text[index] !== "\n") {
        out += " ";
        index += 1;
      }
      continue;
    }

    if (char === "/" && text[index + 1] === "*") {
      while (index < text.length && !(text[index] === "*" && text[index + 1] === "/")) {
        out += text[index] === "\n" ? "\n" : " ";
        index += 1;
      }
      out += "  ";
      index += 2;
      continue;
    }

    out += char;
    index += 1;
  }

  // Trailing commas are legal in jsonc and common in wrangler files.
  return JSON.parse(out.replace(/,(\s*[}\]])/g, "$1"));
}
