# Handoff — jotDOJO onboarding + node resize

Working state as of 2026-08-21. Delete this file once the open items below are closed.

## Shipped and verified

- **`dd1c3e61a`** — node `Standard_D2ads_v7` → `D4ads_v7` (one bigger node, not a
  second; identical cost, ~2 GiB more usable memory), `os_disk_size_gb` 110 → 220,
  plus `terraform/envs/azure/jotdojo.tf` (jotDOJO database, Key Vault, blob
  account, container), the `VECTOR/PG_TRGM/CITEXT` extension allow-list, Caddy
  routes and the TLS allow-list entries.
- **`b31b685c8`** — moved jotDOJO's app registration and role assignments out of
  `envs/azure` (applied by CI, Contributor-only) into `bootstrap-azure`
  (human-applied). The release was 403ing on `Authorization_RequestDenied` and
  `roleAssignments/write`; both are gone.
- **Release `32500071470` succeeded — `v1.223.0`.** Every stage green. The thing
  that had actually kept the pipeline red since 2026-08-19 was nine missing
  Piggles Stripe secrets, now loaded into `kv-sparx-prod-cus` (vault at 85).
- **`bootstrap-azure` applied.** `gha-jotdojo-prod` exists
  (`AZURE_CLIENT_ID=3b699e03-a984-48b2-b5cd-ca9824a680c7`), plan now reports
  "No changes". One 409 on `jotdojo_operator_kv` was a pre-existing identical
  assignment and was imported rather than recreated.
- **`2a1388473` — shipped as `v1.224.0`.** Release `32533830105` green end to
  end: every build, infrastructure, data, containers, cleanup, tag. All five
  jotDOJO hostnames now resolve to Cloudflare's anycast pair, which is what
  `proxied = true` looks like from outside.

  The commit itself is the `jotdojo.com` zone in the DNS module, the corrected
  Caddy blocks, and the five-name TLS allow-list.
  The first push attempt died on `@wizeworks/builder` lint with 120
  "type that cannot be resolved" errors against Prisma accessors — nothing to do
  with the commit. The release worktree's generated client was from 2026-08-15,
  and `pnpm install --frozen-lockfile` does not re-run generate when the lockfile
  has not moved. `pnpm exec prisma generate` inside that worktree fixed it, and
  is safe there precisely because the worktree has its own `node_modules`.

## Uncommitted, in the working tree, VALIDATED

~~Mine, ready to commit~~ — **all three shipped in `2a1388473`.** Kept below
because the reasoning is worth having:

- `terraform/modules/dns/main.tf` + `variables.tf` — the `jotdojo.com` zone:
  apex A, `www` CNAME, A records for `app`/`api`/`mcp`, all proxied at the
  ingress IP `20.12.217.0`. New `jotdojo_dns_enabled` variable (defaults true).
- `k8s/ingress/Caddyfile` — apex, `app.` and `www` now ALL proxy to
  `web.jotdojo.svc.cluster.local:80`. The apex is the MARKETING SITE, `app.` is
  the PWA, and they are one Deployment split on Host in the app's middleware
  (ADR-040). `www` is matched by the app, not redirected in Caddy.
- `wizeworks/services/api-rest/.../internal/domain-check.ts` — five hostnames
  allow-listed, `app.jotdojo.com` included.

Verified: `terraform fmt -check -recursive` clean, `envs/azure` validates,
`kubectl kustomize k8s/azure/infra` builds, prettier clean.

NOT mine and also uncommitted: ~900 files of concurrent piggles / marketplace /
api-rest work. **Do not `git add -A`.** Stage by path.

## Pushing is not straightforward — read this

`check-console-parity.mjs` uses `fs.readdirSync`, so the pre-push guard inspects
what is ON DISK, not what is committed. Six piggles files in the working tree
make it fail, so a normal `git push` from this checkout is blocked regardless of
what you committed.

The repo's documented escape hatch (and what has now worked three times):

`g:/code/@wizeworks/sparx-release` was already registered, clean, and last
touched 2026-08-15, so reusing it skipped a fresh several-GB install. It is now
detached at `2a1388473`, which is `main` — a fine resting state for the next
push. Check it is still clean and idle before reusing it; if someone else has
claimed it, make a new one:

```
git worktree add --detach g:/code/@wizeworks/sparx-push main
cd g:/code/@wizeworks/sparx-push && git push origin HEAD:main
# then: git worktree remove --force <path>; rm -rf <path>; git worktree prune
```

The guard runs a full `pnpm install` in that fresh worktree (slow, several GB)
and generates a Prisma client THERE — which is the one path that avoids touching
the client the running dev stack holds open.

## Open items

1. ~~Set jotDOJO's four repo variables.~~ **DONE** — all four are set on
   `brandonkorous/jotdojo` (`gh variable list -R brandonkorous/jotdojo`).
   For the record: `terraform output jotdojo_github_setup` in
   `terraform/bootstrap-azure` prints them verbatim, and
   `TF_VAR_subscription_id` must be set first — in PowerShell that is
   `$env:TF_VAR_subscription_id='...'`, because bash `VAR=x cmd` prefixing is
   not valid PowerShell.
2. **Purge nine soft-deleted secrets from `kv-jotdojo-prod-cus`.** Less urgent
   than this file first claimed, and the correction matters because it changes
   whether this is a rush. jotDOJO's CI identity holds `Key Vault Secrets User`,
   which is `getSecret` and list — it does NOT include `recover`, so that pipeline
   cannot bring a soft-deleted secret back. Only a Secrets Officer can, and the
   window closes on its own: Azure purges all nine automatically on 2026-08-28.

   What is left is still worth closing — nine live Piggles credentials, including
   the Stripe secret key, sitting for a week in a vault belonging to a different
   product. All nine are confirmed present and enabled in `kv-sparx-prod-cus`,
   and release `v1.223.0` went green reading them from there, so purging the
   jotDOJO copies loses nothing.

   `az keyvault secret purge --vault-name kv-jotdojo-prod-cus --name <n>`.
   Irreversible, so it is left for a human to say go.

3. ~~Rename jotDOJO's branch.~~ **ALREADY DONE** — the local branch is `main`
   and `origin/main` exists (one `Initial commit` holding only README.md). The
   federated credential trusts `refs/heads/main` ONLY, so this matches.
   NOTE: jotDOJO has **never been committed** — ~200 files sit uncommitted on an
   unborn local `main`, including everything added for this onboarding
   (`infra/k8s/*`, `infra/docker/*`, `.github/workflows/*`,
   `docs/17-shared-infrastructure.md`, the `DB_POOL_MAX` change). Its first
   commit and push are still to happen, and nothing deploys until they do.

4. **Console parity — now EIGHT problems**, up from six, as the concurrent
   piggles work has continued. Four are the original real gaps:
   `lib/payment-terms`, `lib/payment-methods`, `lib/invoice-status`,
   `components/payment-terms-field` exist in the piggles console with no sparx
   workbench counterpart, and both consoles have an `invoicing` surface.
   `lib/onboarding/piggles-words` is a legitimate EXCEPTION (it translates
   api-rest's sparx-worded copy into the Piggles lexicon; sparx needs nothing
   because api-rest already speaks sparx). `lib/slugify` is undecided.
5. **jotDOJO's Key Vault is EMPTY, and its release refuses to deploy without
   eight secrets.** `kv-jotdojo-prod-cus` holds zero live secrets; the only
   things in it are the nine soft-deleted Piggles ones from item 2. The release's
   "Read secrets from Key Vault" step fails the run by design when any required
   name is absent, so the first deploy stops there. Required, stored kebab-cased
   (`DATABASE_URL` -> `DATABASE-URL`):

   `DATABASE_URL`, `DATABASE_ADMIN_URL`, `JOTDOJO_APP_PASSWORD`, `AUTH_SECRET`,
   `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AZURE_STORAGE_ACCOUNT`,
   `AZURE_STORAGE_KEY`.

   Six are derivable here — the server is
   `psql-sparx-prod-cus.postgres.database.azure.com`, the database is `jotdojo`,
   the storage account is `stjotdojoprodcus`, and `AUTH_SECRET` +
   `JOTDOJO_APP_PASSWORD` are simply generated. Only the two Google OAuth values
   have to come from a Google Cloud console. Loading them is a human action on
   purpose: jotDOJO's CI identity holds Key Vault Secrets **User** (get + list,
   never write), so a compromised workflow cannot rewrite a credential the
   product then deploys.

6. **`DATABASE_ADMIN_URL` would hand jotDOJO the SPARX server admin.** Worth
   settling before it is loaded rather than after. The server's only
   administrator is `sparx_owner`, jotDOJO creates no owner role of its own
   (`0000_init.sql` makes `jotdojo_worker`, `0001_app_role.sql` makes
   `jotdojo_app`, neither owns anything), and an Azure Flexible Server database
   is owned by the server admin unless something says otherwise. So the migration
   Job's connection string is `sparx_owner`, which reaches the sparx and piggles
   databases just as easily as it reaches `jotdojo` — and it would live in a
   Kubernetes Secret in the `jotdojo` namespace.

   The fix is a `jotdojo_owner` role owning the `jotdojo` database, after which
   jotDOJO's vault holds only jotdojo credentials. It cannot be created from
   outside: the server is private-IP, so the role has to be minted by a Job in
   the cluster, which means the FIRST run still uses `sparx_owner` and hands over
   before the second. That bootstrap-once shape is the decision to make.

7. **Three stale worktrees** registered from earlier sessions, two pointing into
   temp scratchpad dirs, each carrying a full `node_modules` if it still exists:
   `.../3e8bb81e-.../push-head`, `.../4a2a693d-.../push-gate`,
   `g:/code/@wizeworks/sparx-release`. Not mine; `git worktree list` to see them.

## Rules learned the hard way today

- **Per-deploy work belongs in a workflow; anything granting Azure privilege
  belongs in the human-applied bootstrap.** CI holds subscription Contributor and
  no Graph rights, deliberately — Contributor cannot grant roles, which is what
  stops the pipeline minting its own successor identities. DNS records ARE
  automatable (Cloudflare token, not Azure RBAC) and run in the release.
- **Key Vault naming is `tr 'a-z-' 'A-Z_'`** — kebab in the vault, SCREAMING_SNAKE
  in the env, bijective.
- Git Bash mangles a leading `/` in an Azure resource ID into `C:/Program Files/Git/...`.
  Use the PowerShell tool for `terraform import`.
