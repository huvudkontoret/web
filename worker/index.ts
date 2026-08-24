/**
 * One Worker, every domain.
 *
 * The Host header names the perspective; the path names the thing. This maps
 * the first onto a subtree of the build and refuses anything that reaches into
 * a neighbouring domain, so huvudkontoret.io/name/x is a 404 rather than a
 * second address for the same page.
 *
 * assets.run_worker_first must stay true in wrangler.jsonc. Workers serve
 * static assets ahead of the script by default, which would answer that exact
 * request out of dist/ and never reach the rule below.
 */

import { byHost, crossesTree, isShared, toAssetPath } from "../src/lib/tld.ts";

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
}

/**
 * Preview URLs are a single host — <branch>-web.<subdomain>.workers.dev — and
 * cannot carry ten domains. There they behave like `astro dev`: prefix paths,
 * served directly. Previews therefore do not exercise Host mapping, which is
 * why worker/index.test.mjs is the real guarantee. See ADR 0002.
 */
function isPreviewHost(host: string): boolean {
  return host.toLowerCase().split(":")[0].endsWith(".workers.dev");
}

function notFound(): Response {
  return new Response("Not found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (isPreviewHost(url.hostname)) return env.ASSETS.fetch(request);

    const tld = byHost(url.host);
    if (!tld || tld.status !== "live") return notFound();

    if (isShared(url.pathname)) return env.ASSETS.fetch(request);
    if (crossesTree(url.pathname, tld)) return notFound();

    const target = new URL(url);
    target.pathname = toAssetPath(url.pathname, tld);
    return env.ASSETS.fetch(new Request(target, request));
  },
};
