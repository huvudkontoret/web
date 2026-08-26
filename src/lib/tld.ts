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
 *
 * The table is every `huvudkontoret.*` domain, not only the ones with a job. A
 * domain we pay for and cannot name a purpose for is a fact about the company,
 * and the honest place to record it is next to the ones that do have a
 * purpose. Other names the company owns are out of scope — this is the address
 * doctrine, one name through many top-level domains, not a list of everything
 * that renews. See docs/runbooks/2026-08-24-domain-activation.md for the
 * inventory this was reconciled against.
 *
 * Which domains are lenses is not decided here. `.io` publishes the list in its
 * own SYSTEMET section — eight addresses, each with a POW line and an accent —
 * and the graphic profile owns the accents (ADR 0002). This file follows that
 * page. When the two disagree, the page is right and this file is the bug.
 */

/** What the Worker does with a domain — not what the registrar thinks. */
export type TldStatus =
  /** Routed and served. */
  | "live"
  /** Registered and intended, but not yet delegated to Cloudflare or routed. */
  | "planned"
  /** Registered and publicly announced as not running. */
  | "not-in-service"
  /** Registered defensively. No role, nothing announced, nothing promised. */
  | "held";

export type TldKind =
  /** Hand-written and byte-exact: the system lens, `.io`. */
  | "static"
  /** A lens on a shared node — render(node, perspective). */
  | "perspective"
  /** A lens with its own content, not drawn from a person node. */
  | "surface"
  /** Not a lens. Held, and nothing is designed for it. */
  | "undecided";

/**
 * Where the zone's authoritative DNS actually lives today.
 *
 * This is the fact that gates everything else. Cloudflare refuses a Worker
 * custom domain on a zone in another account, so a domain can only go `live`
 * once its zone sits in Huvudkontoret's own Cloudflare account — see the memo
 * on the zone move and ADR 0001.
 */
export type Delegation =
  /** Cloudflare, Huvudkontoret's own account. The only place a domain can go live from. */
  | "cloudflare-hk"
  /** Cloudflare, but Sharpest Root's account. Resolves fine; cannot carry our Worker. */
  | "cloudflare-sharpest"
  /** Registrar nameservers, Loopia. Parked. */
  | "loopia"
  /** Registrar nameservers, Namecheap. Parked. */
  | "namecheap";

export type Registrar = "ascio" | "namecheap";

export interface Tld {
  readonly key: string;
  readonly host: string;
  readonly kind: TldKind;
  /** Where this domain's bytes live in the build. `.io` owns the root. */
  readonly tree: string;
  readonly status: TldStatus;
  /** Who we renew with. Ascio is reached through Loopia. */
  readonly registrar: Registrar;
  /** Whose nameservers answer for it today. */
  readonly delegation: Delegation;
}

/**
 * Served identically on every host. Every domain shares one set of logos,
 * fonts and sigills; without this they would each 404 on /assets/.
 * Astro's own per-perspective output lands under <tree>/_astro/ and is not
 * shared.
 */
export const SHARED_PATHS: readonly string[] = ["/assets/"];

export const tlds = {
  // ── The eight lenses ────────────────────────────────────────────────────
  // The set .io publishes in its SYSTEMET section. The POW line after each row
  // is that page's own wording, quoted so a change there is visible as a diff
  // here. It is a quotation, not a definition — see ADR 0002.

  /** "visar systemet: du är här" */
  io: {
    key: "io",
    host: "huvudkontoret.io",
    kind: "static",
    tree: "/",
    status: "live",
    registrar: "ascio",
    delegation: "cloudflare-hk",
  },

  /** "visar människorna: en adress per person" */
  name: {
    key: "name",
    host: "huvudkontoret.name",
    kind: "perspective",
    tree: "/name/",
    status: "planned",
    registrar: "ascio",
    delegation: "loopia",
  },

  /** "visar kompetensen: bevis, inte pitch" */
  cv: {
    key: "cv",
    host: "huvudkontoret.cv",
    kind: "perspective",
    tree: "/cv/",
    status: "planned",
    registrar: "namecheap",
    delegation: "namecheap",
  },

  /** "visar bygget: dokumentation, arkitektur, projekt" */
  dev: {
    key: "dev",
    host: "huvudkontoret.dev",
    kind: "surface",
    tree: "/dev/",
    status: "planned",
    registrar: "ascio",
    delegation: "cloudflare-hk",
  },

  /** "visar experimenten: vår whiteboard. hk, kl och kull bor här tills de bär" */
  xyz: {
    key: "xyz",
    host: "huvudkontoret.xyz",
    kind: "surface",
    tree: "/xyz/",
    status: "planned",
    registrar: "ascio",
    delegation: "loopia",
  },

  // Announced on .io with [ SNART ]. The gate holds the copy to it: an address
  // that appears without an in-service marker fails the surfaces check.

  /** "visar intelligensen: agenter och arbetsflöden i drift [ SNART ]" */
  ai: {
    key: "ai",
    host: "huvudkontoret.ai",
    kind: "surface",
    tree: "/ai/",
    status: "not-in-service",
    registrar: "ascio",
    delegation: "loopia",
  },

  /** "visar produkterna: testa själv innan du frågar [ SNART ]" */
  app: {
    key: "app",
    host: "huvudkontoret.app",
    kind: "surface",
    tree: "/app/",
    status: "not-in-service",
    registrar: "ascio",
    delegation: "loopia",
  },

  /** "visar riktningen: rösta på vad vi bygger härnäst [ SNART ]" */
  vote: {
    key: "vote",
    host: "huvudkontoret.vote",
    kind: "surface",
    tree: "/vote/",
    status: "not-in-service",
    registrar: "namecheap",
    delegation: "namecheap",
  },

  // ── Held ────────────────────────────────────────────────────────────────
  // Registered, renewed, and not a lens. The May 2026 domain strategy gives
  // several of them a purpose — .blog editorial, .club community, .link short
  // URLs, .email newsletters — but .io does not announce them and nothing is
  // designed for them, so a purpose on paper is not a lens. .sh and .systems
  // were bought on 2026-08-24 with no role attached, which is the same state
  // arrived at deliberately. Listed here so that "no decision" is visible
  // rather than implied.
  blog: {
    key: "blog",
    host: "huvudkontoret.blog",
    kind: "undecided",
    tree: "/blog/",
    status: "held",
    registrar: "ascio",
    delegation: "loopia",
  },
  club: {
    key: "club",
    host: "huvudkontoret.club",
    kind: "undecided",
    tree: "/club/",
    status: "held",
    registrar: "ascio",
    delegation: "loopia",
  },
  link: {
    key: "link",
    host: "huvudkontoret.link",
    kind: "undecided",
    tree: "/link/",
    status: "held",
    registrar: "ascio",
    delegation: "loopia",
  },
  email: {
    key: "email",
    host: "huvudkontoret.email",
    kind: "undecided",
    tree: "/email/",
    status: "held",
    registrar: "ascio",
    delegation: "loopia",
  },
  news: {
    key: "news",
    host: "huvudkontoret.news",
    kind: "undecided",
    tree: "/news/",
    status: "held",
    registrar: "namecheap",
    delegation: "namecheap",
  },
  wtf: {
    key: "wtf",
    host: "huvudkontoret.wtf",
    kind: "undecided",
    tree: "/wtf/",
    status: "held",
    registrar: "namecheap",
    delegation: "namecheap",
  },
  tech: {
    key: "tech",
    host: "huvudkontoret.tech",
    kind: "undecided",
    tree: "/tech/",
    status: "held",
    registrar: "ascio",
    delegation: "cloudflare-hk",
  },
  cloud: {
    key: "cloud",
    host: "huvudkontoret.cloud",
    kind: "undecided",
    tree: "/cloud/",
    status: "held",
    registrar: "ascio",
    delegation: "loopia",
  },
  store: {
    key: "store",
    host: "huvudkontoret.store",
    kind: "undecided",
    tree: "/store/",
    status: "held",
    registrar: "ascio",
    delegation: "loopia",
  },
  one: {
    key: "one",
    host: "huvudkontoret.one",
    kind: "undecided",
    tree: "/one/",
    status: "held",
    registrar: "ascio",
    delegation: "loopia",
  },
  info: {
    key: "info",
    host: "huvudkontoret.info",
    kind: "undecided",
    tree: "/info/",
    status: "held",
    registrar: "ascio",
    delegation: "loopia",
  },
  site: {
    key: "site",
    host: "huvudkontoret.site",
    kind: "undecided",
    tree: "/site/",
    status: "held",
    registrar: "ascio",
    delegation: "loopia",
  },
  website: {
    key: "website",
    host: "huvudkontoret.website",
    kind: "undecided",
    tree: "/website/",
    status: "held",
    registrar: "ascio",
    delegation: "loopia",
  },
  online: {
    key: "online",
    host: "huvudkontoret.online",
    kind: "undecided",
    tree: "/online/",
    status: "held",
    registrar: "ascio",
    delegation: "loopia",
  },
  sh: {
    key: "sh",
    host: "huvudkontoret.sh",
    kind: "undecided",
    tree: "/sh/",
    status: "held",
    registrar: "namecheap",
    delegation: "namecheap",
  },
  systems: {
    key: "systems",
    host: "huvudkontoret.systems",
    kind: "undecided",
    tree: "/systems/",
    status: "held",
    registrar: "namecheap",
    delegation: "namecheap",
  },
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

/**
 * Whether a custom domain for this host can exist at all.
 *
 * `status: "live"` says what this Worker is meant to answer for. It is not the
 * same question as whether Cloudflare will let us say so: a custom domain
 * cannot be created on a zone in another account, so intent and possibility
 * come apart, and today every domain fails on possibility. Keeping the two
 * separate is what stops the route from being added before the zone has moved.
 */
export function canBeRouted(tld: Tld): boolean {
  return tld.status === "live" && tld.delegation === "cloudflare-hk";
}

export function routableTlds(): Tld[] {
  return Object.values(tlds).filter(canBeRouted);
}

/**
 * Domains that cannot be routed yet because their DNS answers somewhere we do
 * not control from Cloudflare. This is the activation backlog, derived rather
 * than maintained: a domain leaves it the moment its zone moves. Held names
 * are excluded — they are not waiting on anything, they are just owned.
 */
export function awaitingDelegation(): Tld[] {
  return Object.values(tlds).filter((tld) => tld.status !== "held" && tld.delegation !== "cloudflare-hk");
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
