/**
 * One Worker, every domain.
 *
 * The Host header names the perspective; the path names the thing. This maps
 * the first onto a subtree of the build and refuses anything that reaches into
 * a neighbouring domain, so huvudkontoret.io/name/x is a 404 rather than a
 * second address for the same page.
 *
 * The homepage runs this script before asset lookup to negotiate Markdown.
 * Other existing assets are served directly; misses reach the routing rules.
 */

import { byHost, crossesTree, isShared, toAssetPath } from "../src/lib/tld.ts";

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
}

const CONTENT_SIGNAL = "search=yes, ai-input=yes, ai-train=no";
const DISCOVERY_LINKS = '</.well-known/api-catalog>; rel="api-catalog", </llms.txt>; rel="describedby"';

/** An explicit Markdown preference is required; wildcards alone keep HTML. */
function prefersMarkdown(accept: string | null): boolean {
  if (!accept) return false;
  const ranges = accept.split(",").map((entry) => {
    const [type, ...parameters] = entry.trim().toLowerCase().split(";").map((part) => part.trim());
    let quality = 1;
    for (const parameter of parameters) {
      const [name, value] = parameter.split("=").map((part) => part.trim());
      if (name === "q") {
        quality = /^(?:0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/.test(value ?? "") ? Number(value) : 0;
      } else if (name !== "charset" || !['utf-8', '"utf-8"'].includes(value)) {
        // Neither representation supplies arbitrary media-type parameters.
        quality = 0;
        break;
      }
    }
    return { type, quality };
  });
  const markdown = ranges.find((range) => range.type === "text/markdown")?.quality ?? 0;
  const html = ["text/html", "text/*", "*/*"]
    .map((type) => ranges.find((range) => range.type === type)?.quality)
    .find((quality) => quality !== undefined) ?? 0;
  return markdown > 0 && markdown >= html;
}

function withPolicy(response: Response): Response {
  const result = new Response(response.body, response);
  result.headers.set("Content-Signal", CONTENT_SIGNAL);
  return result;
}

async function serveAsset(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const homepage = url.pathname === "/" || url.pathname === "/index.html";
  const markdown = homepage && ["GET", "HEAD"].includes(request.method) &&
    prefersMarkdown(request.headers.get("Accept"));
  if (markdown) url.pathname = "/index.md";

  const response = withPolicy(await env.ASSETS.fetch(new Request(url, request)));
  if (homepage) {
    const vary = response.headers.get("Vary");
    if (!vary?.split(",").some((value) => ["accept", "*"].includes(value.trim().toLowerCase()))) {
      response.headers.set("Vary", vary ? `${vary}, Accept` : "Accept");
    }
    response.headers.set("Link", DISCOVERY_LINKS);
    if (markdown && (response.ok || response.status === 304)) {
      response.headers.set("Content-Type", "text/markdown; charset=utf-8");
    }
  }
  return response;
}

/**
 * Preview URLs are a single host — <branch>-web.<subdomain>.workers.dev — and
 * cannot carry ten domains. There they behave like `astro dev`: prefix paths,
 * served directly. Previews therefore do not exercise Host mapping, which is
 * why worker/index.test.mjs is the real guarantee. See ADR 0002.
 */
function isPreviewHost(host: string): boolean {
  return host.endsWith(".workers.dev") || ["localhost", "127.0.0.1", "[::1]"].includes(host);
}

function notFound(): Response {
  return withPolicy(new Response("Not found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } }));
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (isPreviewHost(url.hostname)) return serveAsset(request, env);

    const tld = byHost(url.host);
    if (!tld || tld.status !== "live") return notFound();

    if (isShared(url.pathname)) return serveAsset(request, env);
    if (crossesTree(url.pathname, tld)) return notFound();

    const target = new URL(url);
    target.pathname = toAssetPath(url.pathname, tld);
    return serveAsset(new Request(target, request), env);
  },
};
