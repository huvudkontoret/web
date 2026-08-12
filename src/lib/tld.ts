/**
 * The domains, as data.
 *
 * Five consumers read this file: the Worker, the Astro routes, the agent
 * surface generators, the gate and the documentation. Adding a domain is a row
 * here plus a route in wrangler.jsonc — and the gate fails if one arrives
 * without the other.
 *
 * This file is bundled into the Worker, so it must import neither Astro nor
 * Tailwind and must do no I/O. Routing facts live here; presentation lives in
 * tokens.ts. The Worker never needs to know what colour .cv is.
 */

/** What the Worker does with a domain — not what the registrar thinks. */
export type TldStatus =
  /** Routed and served. */
  | "live"
  /** Registered and intended, but not yet delegated to Cloudflare or routed. */
  | "planned"
  /** Registered and publicly announced as not running. */
  | "not-in-service";

export type TldKind =
  /** Hand-written and byte-exact: the company front. */
  | "static"
  /** A lens on a shared node — render(node, perspective). */
  | "perspective"
  /** Own content that does not live in a person node. */
  | "surface";

export interface Tld {
  readonly key: string;
  readonly host: string;
  readonly kind: TldKind;
  /** Where this domain's bytes live in the build. `.io` owns the root. */
  readonly tree: string;
  readonly status: TldStatus;
}

/**
 * Served identically on every host. All ten domains share one set of logos,
 * fonts and sigills; without this they would each 404 on /assets/.
 * Astro's own per-perspective output lands under <tree>/_astro/ and is not
 * shared.
 */
export const SHARED_PATHS: readonly string[] = ["/assets/"];

export const tlds = {
  io: { key: "io", host: "huvudkontoret.io", kind: "static", tree: "/", status: "live" },
  name: { key: "name", host: "huvudkontoret.name", kind: "perspective", tree: "/name/", status: "planned" },
  cv: { key: "cv", host: "huvudkontoret.cv", kind: "perspective", tree: "/cv/", status: "planned" },
  dev: { key: "dev", host: "huvudkontoret.dev", kind: "perspective", tree: "/dev/", status: "planned" },
  link: { key: "link", host: "huvudkontoret.link", kind: "perspective", tree: "/link/", status: "planned" },
  blog: { key: "blog", host: "huvudkontoret.blog", kind: "surface", tree: "/blog/", status: "planned" },
  club: { key: "club", host: "huvudkontoret.club", kind: "surface", tree: "/club/", status: "planned" },
  ai: { key: "ai", host: "huvudkontoret.ai", kind: "perspective", tree: "/ai/", status: "not-in-service" },
  app: { key: "app", host: "huvudkontoret.app", kind: "surface", tree: "/app/", status: "not-in-service" },
  vote: { key: "vote", host: "huvudkontoret.vote", kind: "surface", tree: "/vote/", status: "not-in-service" },
} as const satisfies Record<string, Tld>;

export type TldKey = keyof typeof tlds;

const byHostIndex = new Map<string, Tld>(Object.values(tlds).map((tld) => [tld.host, tld]));

/** The Host header carries case and sometimes a port; neither identifies a domain. */
export function byHost(host: string): Tld | null {
  if (!host) return null;
  const bare = host.toLowerCase().split(":")[0];
  return byHostIndex.get(bare) ?? null;
}

export function liveTlds(): Tld[] {
  return Object.values(tlds).filter((tld) => tld.status === "live");
}

export function isShared(pathname: string): boolean {
  return SHARED_PATHS.some((prefix) => pathname.startsWith(prefix));
}

/**
 * True when the path reaches into a domain that is not this one. `.io` owns the
 * root, so for it this means any other domain's prefix; for a perspective it
 * means any prefix that is not its own.
 */
export function crossesTree(pathname: string, tld: Tld): boolean {
  return Object.values(tlds).some(
    (other) => other.key !== tld.key && other.tree !== "/" && pathname.startsWith(other.tree),
  );
}

/** Where in the build this host-relative path actually lives. */
export function toAssetPath(pathname: string, tld: Tld): string {
  return `${tld.tree}${pathname.slice(1)}`;
}
