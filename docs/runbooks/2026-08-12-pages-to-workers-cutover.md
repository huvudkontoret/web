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

DNS for the zone is already on Cloudflare (`lennon`/`beth.ns.cloudflare.com`),
so no nameserver change is involved — only records.

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

Merging it hands the apex to the Worker: Cloudflare replaces the four GitHub
Pages A records with its own routing and issues a certificate. Propagation is
usually seconds because the zone is already on Cloudflare.

(Adding the custom domain by hand in Workers & Pages → **web** → Settings →
Domains & Routes achieves the same thing, but the next deploy from `main`
would reconcile it against the config file — so change the file.)

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
3. Repository → Settings → Pages → source **main / (root)**. `CNAME` is still
   in the tree, so the custom domain returns with it.
4. Remove the www redirect rule if it now conflicts with Pages' own redirect.

Certificate issuance can lag a few minutes in either direction. If the apex
serves but the browser complains about the certificate, wait before assuming
the rollback failed.

## After the cutover

- Update the `static site` row in `CONTEXT.md` — it describes Pages as what
  serves the apex.
- Open the follow-up PR that drops `CNAME`, `.nojekyll` and the
  `publishing` check's Pages-specific assertions.
- If the MonoLisa web licence is later confirmed, remove the `.gitignore` and
  `.assetsignore` rules for `assets/fonts/*.woff2` **together**. The gate fails
  if only one goes.
