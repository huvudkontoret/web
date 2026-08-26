# Cutover: GitHub Pages → Cloudflare Workers

The apex is live and a mistake here is visible to everyone. The order below
proves the Worker serves the right thing *before* DNS moves, and every step is
reversible until step 5.

Decision and reasoning: `docs/adr/0001-serve-the-site-from-cloudflare-workers.md`.

## Before you start

Record the current state, because this is what rollback restores:

```
apex A records   185.199.108.153  185.199.109.153  185.199.110.153  185.199.111.153
www              301 → https://huvudkontoret.io/   (served by GitHub)
Pages source     main:/           build_type: legacy      CNAME: huvudkontoret.io
```

DNS for the zone is on Cloudflare, so this cutover changes records and not
nameservers. It does assume the zone is **in the same Cloudflare account as
the Worker** — Cloudflare refuses a custom domain on a zone the account does
not own, and until 2026-08-26 the zone sat in Sharpest Root while the Worker
sat here, which blocked step 5 entirely. Moving it changed the assigned
nameservers from `beth`/`lennon` to `ignacio`/`ollie`; see
`2026-08-24-domain-activation.md` for how that move is done.

## 1. Enable preview builds (Cloudflare dashboard)

Workers & Pages → **web** → Settings → Build → Branch control → enable
**non-production branch builds**. Without this, only `main` builds and pull
requests get no preview.

Then Settings → Domains & Routes → confirm **Preview URLs** is enabled.
`preview_urls: true` in `wrangler.jsonc` also sets this on every deploy, which
is why the repo is the source of truth rather than the toggle.

## 2. Restrict the previews (Cloudflare dashboard)

Same Worker → Settings → enable **Cloudflare Access** for `workers.dev` and
preview URLs, limited to the people who should see unreleased work. Do this
before the first preview exists, not after.

## 3. Prove the Worker (no production impact)

Open a pull request and use the preview URL Cloudflare comments on it. Check
each published surface against the live Pages site:

```
/                          renders, same as huvudkontoret.io
/index.md                  text/markdown
/llms.txt                  text/plain
/sitemap.xml               application/xml
/robots.txt                Content-Signal line intact
/.well-known/api-catalog   200
/.well-known/agent-skills/index.json
/assets/og-image.jpg       200
/CLAUDE.md                 404   ← .assetsignore is working
/tools/check/run.mjs       404   ← .assetsignore is working
```

The last two are the point of the change: they answer `200` on Pages today.

Expect fallback monospace rather than MonoLisa. That is correct — the fonts are
gitignored pending the web licence, and it is not a cutover failure.

## 4. Merge to main

Workers Builds deploys the Worker. It still does not serve the apex: the custom
domain does not exist yet. Verify the deploy succeeded before continuing.

## 5. Move the apex (the irreversible-feeling step)

**This step is a pull request, not a dashboard click.** `wrangler deploy`
creates the custom domains it finds in `wrangler.jsonc`, so putting the apex
route in that file *is* the cutover — it happens the moment the production
build runs after the merge. That is why the route is not there yet, and why
this is deliberately its own reviewable change:

```jsonc
// wrangler.jsonc
"routes": [{ "pattern": "huvudkontoret.io", "custom_domain": true }]
```

```json
// tools/check/facts.json
"expectCustomDomain": true
```

Both, in one PR. The gate fails on either without the other, so the cutover
cannot arrive as a side effect of an unrelated change, and it cannot silently
disappear afterwards.

**Delete the four apex A records first.** Cloudflare does not replace them —
it refuses, and the deploy fails with `Hostname 'huvudkontoret.io' already has
externally managed DNS records (A, CNAME, etc). Delete them first or try a
different hostname. [code: 100117]`. This runbook claimed the opposite until
the 2026-08-26 attempt proved otherwise, and the failed build left `main`
deploying red until it was resolved.

That ordering costs a gap: between deleting the records and the custom domain
existing, the apex resolves to nothing. Keep it to seconds by deleting the
records and creating the domain back to back over the API rather than waiting
on a build:

```bash
# after the route is merged; each returns the record id to delete
curl "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records?type=A&name=huvudkontoret.io" \
  --header "Authorization: Bearer $CLOUDFLARE_API_TOKEN"
```

Creating the domain by hand is not a deviation here: `wrangler.jsonc` already
declares the route, so the next deploy reconciles against the file rather than
fighting it. Cloudflare then issues a certificate; propagation is usually
seconds because the zone is already on Cloudflare.

(The file is still what decides. Adding the domain by hand is how the gap is
kept short, not a way around the config — a deploy from `main` reconciles the
domain against `wrangler.jsonc`, so a hand-made domain the file does not
declare would be removed again.)

Verify:

```
curl -sSI https://huvudkontoret.io/ | head -3
```

`server:` must no longer say `GitHub.com`. Re-check the surface list from
step 3 against the real domain.

## 6. Restore the www redirect

Adding the custom domain does not carry over Pages' 301 from `www`. Rules →
Redirect Rules → new rule:

```
When   hostname equals www.huvudkontoret.io
Then   dynamic redirect → concat("https://huvudkontoret.io", http.request.uri.path)
       status 301, preserve query string
```

Verify `curl -sSI https://www.huvudkontoret.io/` returns 301 to the apex.

## 7. Turn off GitHub Pages

Only once steps 5 and 6 verify. Repository → Settings → Pages → set source to
**None**.

Leave `CNAME` and `.nojekyll` in the repo for now. They are inert but they are
also the fast path back. A follow-up PR removes them together with their checks
in `tools/check` once you are confident — that PR is the real end of the
migration.

## Rollback

Before step 5 there is nothing to undo — Pages is still serving.

After step 5, to go back:

1. Workers & Pages → **web** → Settings → Domains & Routes → remove the
   `huvudkontoret.io` custom domain.
2. DNS → recreate four proxied-off `A` records for the apex:
   `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`.
3. Repository → Settings → Pages → source **main / (root)**, then set the
   custom domain to `huvudkontoret.io` in the same screen. The `CNAME` file
   that used to carry it was removed once the cutover verified, so this is one
   field to fill rather than a file already in the tree.
4. Remove the www redirect rule if it now conflicts with Pages' own redirect.

Certificate issuance can lag a few minutes in either direction. If the apex
serves but the browser complains about the certificate, wait before assuming
the rollback failed.

## After the cutover

Run on 2026-08-26 and done, listed here because the procedure is what a rerun
would follow, not because anything is outstanding.


- Update the `static site` row in `CONTEXT.md` — it describes Pages as what
  serves the apex.
- Point the dev loop at the Worker: `hk dev web` runs
  `python3 -m http.server` from `hk.json`, which hands out the whole checkout.
  That matches Pages exactly and is precisely what the Worker stops doing —
  `.assetsignore` decides what the site is, so `/CLAUDE.md` answers 200
  locally and 404 on the apex from step 5 onward. Switch the command to
  `npx wrangler dev` and update the `Run:` pointer in `CONTEXT.md` with it.
- Open the follow-up PR that drops `CNAME`, `.nojekyll` and the
  `publishing` check's Pages-specific assertions.
- If the MonoLisa web licence is later confirmed, remove the `.gitignore` and
  `.assetsignore` rules for `assets/fonts/*.woff2` **together**. The gate fails
  if only one goes.
