# Activating the domain estate

Twenty-four domains are registered. Eight of them are lenses — addresses with a
published purpose. The other sixteen are held names. Exactly one serves
anything, and it is served by GitHub Pages rather than by this repo's Worker.

This runbook is the verified inventory behind `src/lib/tld.ts`, the single
blocker that holds all of it, and the order the lenses come online in once that
blocker clears.

Reconciled 2026-08-24 against DNS, RDAP and the registrars, and again on
2026-08-26 for the three zones that moved account. The registry test
`the registry holds every domain Huvudkontoret owns and no others` fails if
this inventory and the code drift apart.

## The blocker, and how it cleared

**Cleared 2026-08-26.** All three zones we have on Cloudflare —
`huvudkontoret.io`, `huvudkontoret.dev` and `huvudkontoret.tech` — are now
active in our own account (`6d907037897704cfd96e793b6a71e908`), and the
Sharpest Root zones they came from read `moved`.

What it was: Cloudflare refuses a Worker custom domain on a zone the account
does not own, through the dashboard, Wrangler and the API alike. The zones sat
in Sharpest Root while the Worker sat here, so the Pages → Workers cutover had
nothing to attach to, no second domain could be added, and the TLD workspace
shell could not merge behind it. `canBeRouted()` in the registry is that fact
expressed in code.

How it cleared, and the part worth keeping: the answer was **not** a new
account. `infra@huvudkontoret.io` was made Super Administrator on the account
that already held the Worker, which is what a role account is for — a second
account would have moved the same blocker one step sideways, since the Worker,
its Workers Builds connection and its tokens would then have been in the wrong
place instead of the zones.

## What we own

| Domain | Registrar | DNS today | Status in the registry | Registered |
|---|---|---|---|---|
| `huvudkontoret.io` | Ascio (via Loopia) | Cloudflare — Huvudkontoret | `live` (front, not yet routed) | 2026-02-04 |
| `huvudkontoret.dev` | Ascio (via Loopia) | Cloudflare — Huvudkontoret | `live` (lens) | 2026-02-05 |
| `huvudkontoret.tech` | Ascio (via Loopia) | Cloudflare — Huvudkontoret | `held` | 2026-02-04 |
| `huvudkontoret.ai` | Ascio (via Loopia) | Loopia | `not-in-service` (lens, SNART) | 2026-05-12 |
| `huvudkontoret.name` | Ascio (via Loopia) | Loopia | `planned` (lens) | 2026-05-12 |
| `huvudkontoret.blog` | Ascio (via Loopia) | Loopia | `held` | 2026-05-12 |
| `huvudkontoret.club` | Ascio (via Loopia) | Cloudflare — Huvudkontoret | `live` (lens since 2026-11-14, see below) | 2026-05-12 |
| `huvudkontoret.link` | Ascio (via Loopia) | Loopia | `held` | 2026-05-12 |
| `huvudkontoret.xyz` | Ascio (via Loopia) | Cloudflare — Huvudkontoret | `live` (lens) | 2026-05-12 |
| `huvudkontoret.email` | Ascio (via Loopia) | Loopia | `held` | 2026-05-12 |
| `huvudkontoret.one` | Ascio (via Loopia) | Loopia | `held` | 2026-05-12 |
| `huvudkontoret.info` | Ascio (via Loopia) | Loopia | `held` | 2026-05-12 |
| `huvudkontoret.site` | Ascio (via Loopia) | Loopia | `held` | 2026-05-12 |
| `huvudkontoret.website` | Ascio (via Loopia) | Loopia | `held` | 2026-05-12 |
| `huvudkontoret.online` | Ascio (via Loopia) | Loopia | `held` | 2026-05-12 |
| `huvudkontoret.store` | Ascio (via Loopia) | Loopia | `held` | 2026-05-12 |
| `huvudkontoret.cloud` | Ascio (via Loopia) | Loopia | `held` | 2026-05-12 |
| `huvudkontoret.app` | Ascio | Loopia | `not-in-service` (lens, SNART) | 2026-05-13 |
| `huvudkontoret.cv` | Namecheap | Namecheap | `planned` (lens) | 2026-05-13 |
| `huvudkontoret.news` | Namecheap | Namecheap | `held` | 2026-05-13 |
| `huvudkontoret.vote` | Namecheap | Namecheap | `not-in-service` (lens, SNART) | 2026-05-13 |
| `huvudkontoret.wtf` | Namecheap | Namecheap | `held` | 2026-08-11 |
| `huvudkontoret.sh` | Namecheap | Namecheap | `held` | 2026-08-24 |
| `huvudkontoret.systems` | Namecheap | Namecheap | `held` | 2026-08-24 |

**Amended 2026-11-14: `.club` is a lens.** The canon's domain register lifted
it from sketch to lens on 2026-09-11, when it got an owner node, and the design
"Club v2" gave it a page, built here as `club/index.html`. From that date this
document's counts read nine lenses and fifteen held names, so "the sixteen"
below means fifteen.

It is also the first lens to go live after `.io`, so it is the proof step 3
gave to `.name`. Two things in that step turned out differently and are
corrected there: the redirect rule decides what the apex answers for as long
as it matches, and the Worker has to run before asset lookup for the host to
decide anything.

Before the day:

- The Worker-first routing is already in production and `.io` has been checked
  with it. It lands with the page, ahead of the route, so the one change that
  touches every `.io` page is not made in the same deploy as the cutover.
- `assets/fonts/README.md` says what the MonoLisa licence covers on a second
  domain.
- `huvudkontoret.club` has its own Web Analytics site, and its token is in
  `club/index.html` and under `pageTokens` in `tools/check/facts.json`. Without
  it the page goes live unmeasured.
- The account's Workers plan is known. On Free, every page request now counts
  against the daily quota (see the comment in `wrangler.jsonc`).
- `npx wrangler dev --host huvudkontoret.club` shows the club page at `/` and
  a 404 at `/profil`.

The order. The redirect rule is the switch, not DNS: it runs before the Worker,
so the apex keeps answering with today's 301 until the rule is narrowed.

0. Have the pull request that sets `status: "live"` and adds the route green
   and ready to merge. Nothing else merges to `main` until step 3 is done.
1. In the `huvudkontoret.club` zone, turn on Always Use HTTPS. Then delete the
   proxied `AAAA @ -> 100::` and, back to back, add `huvudkontoret.club` as a
   custom domain on the Worker `web` (Workers & Pages > web > Settings >
   Domains & Routes). Keep the `www` record and leave the redirect rule alone.
   Apex and `www` keep answering 301 to `.io`; the only gap is the seconds
   between the two actions.
2. Merge the pull request and wait for the production build. `wrangler deploy`
   finds the domain it declares already attached.
3. Narrow the zone's redirect rule to `www.huvudkontoret.club` and point it at
   `https://huvudkontoret.club/`. The club page is live from this moment.
4. Verify. `https://huvudkontoret.club/` answers 200 with the title
   `huvudkontoret.club · AI, pizza och öl 17 november`;
   `http://huvudkontoret.club/` answers 301 to the `https` address;
   `https://huvudkontoret.club/profil` and `https://huvudkontoret.io/club/` are
   both 404; `www` redirects to the apex. Then the `.io` surface: `/`,
   `/profil`, `/index.md`, `/llms.txt`, `/robots.txt` and `/sitemap.xml` answer
   200, `/.well-known/api-catalog` answers `application/linkset+json`, and
   `curl -H 'Accept: text/markdown' https://huvudkontoret.io/` answers
   `text/markdown`.

To back out: (1) widen the redirect rule back to apex and `www` ->
`https://huvudkontoret.io/`, the held-name rule from step 5. That restores
today's behaviour at once, whatever the Worker does. (2) Revert the pull
request and let the build deploy. (3) Remove the custom domain from the Worker
if it is still listed, and recreate the proxied `AAAA @ -> 100::` back to back.
If `huvudkontoret.io` itself misbehaves after a deploy, roll the Worker back to
the previous version first (`npx wrangler rollback`, or Deployments in the
dashboard), then revert.

**`.xyz` and `.dev` follow the same order**, one zone at a time, with the
`.club` steps above read for that zone's name. What differs:

- The pages have to be on `main` first: `xyz/` (the wall, `/001`, `/002`) and
  `dev/` (the root and `/kl`). The two lenses link to each other, so take them
  live in the same sitting.
- The `huvudkontoret.dev` zone also carries `kl.huvudkontoret.dev`, the custom
  domain of the `kl-sync` Worker. Leave its record alone and check that the
  redirect rule names only the apex and `www` before and after it is narrowed;
  `https://kl.huvudkontoret.dev/sync/v1` answers 401 without a token, before
  and after.
- Verify the addresses as they are printed, without the trailing slash:
  `https://huvudkontoret.xyz/002` and `https://huvudkontoret.dev/kl` each
  answer one redirect to the slashed form and then 200. On both hosts
  `/profil` is 404, and on `.io` `/xyz/` and `/dev/` are 404.
- `.dev` is on the HSTS preload list as a whole, so there is no plain-HTTP
  case to check there.
- Each host needs its own Web Analytics site and its pages their own token
  under `pageTokens`, as for `.club`.

Renewals cluster: fourteen Ascio names fall due 2027-05-12, three Namecheap
names 2027-05-13, `.wtf` 2027-08-11, `.sh` and `.systems` 2027-08-24, `.io` and
`.tech` 2027-02-04, `.dev` 2027-02-05. `.ai` runs to 2028-05-12.

## Not in the registry, but in the account

`lulea.ai` (Ascio, registered 2026-08-26) sits in the same Cloudflare account
and is deliberately absent from `src/lib/tld.ts`: it is a different name, not a
perspective on this one, and the registry is the address doctrine rather than a
list of everything that renews. Parked — zone present, no records, nothing
served.

Its nameserver pair is `daisy`/`dax`, **not** the `ignacio`/`ollie` every
`huvudkontoret.*` zone got. The pair belongs to the zone, not to the account:
deleting and re-adding returns the same zone id and the same pair. Read what
the zone reports before going to the registrar.

## What we do not own

Worth writing down, because the name is not ours alone and the plan has twice
assumed otherwise.

| Domain | Reality |
|---|---|
| `huvudkontoret.se` | Taken. Belongs to Huvudkontoret in Helsingborg — two office hotels — and redirects to `hk.se`. Held since 2018 via LoopiaGroup. |
| `huvudkontoret.nu` | Taken, same owner as `.se`, since 2019. |
| `huvudkontoret.com` | Taken. Parked for sale by DomainMarket since 2012. |
| `huvudkontoret.org`, `.me`, `.page`, `.fyi`, `.co`, `.eu`, `.studio`, `.agency`, `.works` | Not registered. |

`huvudkontoret.net` (Ascio, Loopia nameservers, registered 2014-03-03, expires
2027-03-03) resolves to a Loopia parking page indistinguishable from ours. The
registration predates every domain we bought by eleven years, so it is more
likely the Helsingborg company's than ours. **Open item: confirm in the Loopia
control panel.** It is deliberately absent from the registry until then —
`.net` is the one row that would be a guess rather than a fact.

That another company trades under the same name on `.se` and `.nu` is a
standing fact about the brand, not a problem to solve here. It is the reason
`.io` is the front.

## Order of activation

### 0. Move the zones (Sharpest → Huvudkontoret)

Nothing starts until this lands. Two zones, done as two steps, because they
carry very different risk.

**A move between accounts is a registrar change, not a Cloudflare button.**
The zone is re-added in the target account, which assigns a *different*
nameserver pair, and the delegation is then repointed at the registrar. The old
zone goes to `moved` on its own once the change is seen; nothing needs deleting
in the source account.

**Do not trust the quick scan.** Adding the zone offers the records it can
resolve, which for a *proxied* source zone are Cloudflare's own edge addresses
— importing those gives a proxied record pointing at Cloudflare, which is the
error 1000 loop. Delete what the scan proposes, then either import the export
above or let an unproxied source zone be scanned and verify the result record
for record.

**`huvudkontoret.dev` first.** It is empty — Loopia parking records and nothing
else. No mail, no TXT, nothing anyone asks for. Moving it costs nothing and it
unblocks kl's sync service as well as this repo.

**`huvudkontoret.io` second, as its own planned step.** It carries Google
Workspace (MX, SPF, DKIM, DMARC), the GitHub Pages A records and the Sites
CNAMEs for brandbook and portal. All unproxied, which makes the move
mechanical, but the mail records must be recreated exactly. Export the full
record set before starting:

```bash
# from an account that can read the Sharpest zone. Not wrangler: it has no
# zone or DNS commands, and its OAuth grant tops out at zone:read.
curl "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records/export" \
  --header "Authorization: Bearer $CLOUDFLARE_API_TOKEN" > io-zone-$(date +%F).txt
```

Both are reversible — a zone can be moved back between accounts.

Then invite Sharpest into our account with the role they want: `DNS` to keep
editing records, `Administrator Read Only` for insight alone.

### 1. Finish the cutover

`docs/runbooks/2026-08-12-pages-to-workers-cutover.md`, unchanged, except that
step 5 now runs against a zone in our own account. The route entry in
`wrangler.jsonc` and `expectCustomDomain: true` in `tools/check/facts.json` are
one decision and the gate fails on one without the other.

At the end of this, `.io` is served by this repo and `canBeRouted(tlds.io)` is
true.

### 2. Merge the TLD workspace shell

`docs/plans/2026-08-12-tld-workspace-shell.md`, tasks 3–6. Tasks 1 and 2 —
registry and Worker — are done and merged into the branch already. No new
domain is added here; the acceptance test is that `.io` publishes byte-identical
bytes before and after.

### 3. `.name`, as the proof

One lens, end to end: delegate to Cloudflare, add the route, generate its agent
surfaces, build the page on the chrome. Rollback is deleting a route. This is
where the chain either holds or does not.

**Delete the lens's placeholder record first.** Every lens carries a proxied
`AAAA -> 100::` on apex and `www` from step 5, and Cloudflare refuses a custom
domain on a hostname that already has records — `code 100117`, the same failure
that broke the `.io` cutover on 2026-08-26. Remove the apex record, then let
`wrangler deploy` create the domain.

**The redirect rule is what the apex answers until it is narrowed.**
(Corrected 2026-11-14; this step used to say a route is matched before the
rule.) Single Redirects run in the first request phase, ahead of any Worker, so
for as long as the rule matches the apex it answers and the Worker is never
asked. That makes the rule the switch: attach the domain and deploy behind it,
then narrow it to `www` and point it at the lens's own apex. The `.club`
amendment above gives the order.

**The Worker has to run first.** The asset layer matches a request on its path
alone and, left to itself, answers before the Worker: a lens's tree would be
served under its prefix on `.io`, and `.io`'s pages on the lens. `wrangler.jsonc`
puts the Worker first for everything outside `/assets/`, and the gate holds it
there.

`.name` goes first because it is the only lens whose content already exists as
data — `src/content/nodes/magnusrenholm.yaml`, recoverable from `bf21a0b^`. The
`identity-runtime` branch it lived on has been deleted from the remote; the
commit has not.

### 4. The remaining lenses, one pull request each

By then it is routine: a row's `status` changes from `planned` to `live`, a
route is added, DNS moves. `.cv` next — it renders the same node — then `.dev`
and `.xyz`, which need content written before they need a route.

`.ai`, `.app` and `.vote` stay `not-in-service` until someone builds what they
announce. They are the three the page marks `[ SNART ]`, and the gate holds the
copy to it.

Namecheap names (`.cv`, `.vote`) need their nameservers pointed at Cloudflare
from Namecheap's panel; Ascio/Loopia names from Loopia's. Only `.io`, `.dev`
and `.tech` sit in Sharpest's Loopia account — everything else is ours to
change without asking.

Delegating a Namecheap name drops its default email forwarding (`eforward1-5`
plus Namecheap's SPF). Nothing uses it today; if that changes, Cloudflare Email
Routing replaces it.

### 5. Held names: one redirect rule, no pages

**Decided 2026-08-26: every held name redirects home.** The sixteen never get a
tree, a route or a build. Left alone they resolve to registrar parking, which
is the one outcome worth avoiding — a page we did not write, on our brand. A
404 would have been honest; a redirect is honest *and* useful, and costs the
same.

Per zone, three pieces, all of which can be put in place before the delegation
lands so the name works the moment it does:

- a proxied `AAAA <apex> -> 100::`, and the same for `www`. The discard prefix
  is the placeholder Cloudflare itself uses for Worker custom domains: the edge
  answers, no origin is ever reached
- one dynamic redirect rule, ref `held_name_home`, matching apex and `www`,
  301 to `https://huvudkontoret.io/`

**To the root, not the same path.** A held name has no content, so preserving
the path only turns a dead address into a 404 on the front. `preserve_query_string`
is off for the same reason.

Verified on `.tech` — apex, a deep path and `www` all land on the front.

The lenses carry the same three pieces under the ref `lens_awaiting_content_home`
until each has content of its own. `.dev` included: an apex redirect says
nothing about `sync.huvudkontoret.dev`, which is a subdomain and unaffected.

## Decisions this runbook does not make

- **What `.ai` is for.** The May 2026 domain strategy names `huvudkontoret.ai`
  as the primary web presence. The repo says `.io` is, and the site announces
  `.ai` as not in service. The registry follows the repo. The strategy document
  is older and has not been reconciled with it.
- **Whether the sixteen held names get roles or get dropped.** They cost
  roughly one renewal cycle to decide, clustered on 2027-05-12. `status:
  "held"` exists so that "no decision" is visible rather than implied. The
  cheapest honest position is to renew once and revisit with the lenses live.
- **What `.sh` and `.systems` are for.** Bought 2026-08-24, Namecheap, and held
  with no role. `.io` announces eight addresses, not ten, so neither is a lens
  today. Adding one is a change to the SYSTEMET section, or a row in the canon's
  domain register plus a page as for `.club`, before it is a change to this repo — and both read as infrastructure names, which is territory `.dev`
  and `.cloud` already claim.
