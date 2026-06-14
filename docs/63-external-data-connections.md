# 63 — External Data Connections

Version: 1.0
Author: Brandon Korous
Last Updated: 2026-06-08

> **Status: _Planned — capstone._** This is intentionally the **last** feature on
> the roadmap, not something to sneak in mid-flight. It depends on the Builder
> composition model (docs/40), the binding schema (docs/43), the site render
> path (docs/44), and the tenant-component model (docs/53) all being settled. This
> doc is the complete design so the build, when it comes, is mechanical.

---

## Why this doc

Today a Builder page can only bind to data Sparx itself owns: the tenant's CMS
content types, Commerce products, CRM lists, and site/brand chrome (docs/43). The
next obvious capability — and one the whole no-code industry is conspicuously bad
at — is letting a tenant **bind a live _external_ data source** (a REST/GraphQL
API, or a SQL database they own) and render it inside a Builder page using the
**same** components, theming, responsiveness, and motion that drive native
content.

The motivating example: a tenant wants a **Kanban board** on their site, fed from
an external project-management API, themed to match their brand, on their own
domain. Or a live availability table from their ERP, a flight/weather widget, a
GitHub-issues list, a sports ladder — anything that lives behind an HTTP or SQL
endpoint they control.

### What everyone else does (and why it's worse)

| Platform      | External-data story                                                                                              | Limitation                                                                                              |
| ------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **Webflow**   | Push data **into** Webflow CMS via their Data API / CSV / sync tools.                                            | Cannot bind an external API/SQL/CMS **as** a native collection. You mirror first, then bind the mirror. |
| **Notion**    | Third-party connectors (Note API Connector, etc.) **poll** an API on a schedule and write rows into a Notion DB. | Not live; not hosted alongside commerce/CMS/email; sync-into-our-store, not bind-in-place.              |
| **WordPress** | Hand-coded dynamic Gutenberg block + `register_rest_route` proxy + transient cache.                              | Bespoke PHP per integration; no uniform model; not visual.                                              |
| **Framer**    | `fetch` from APIs in code components; forms POST to external endpoints.                                          | Code components only; not a first-class bindable source.                                                |

The common failure is that **none of them have a uniform binding model that an
external source can simply join.** Sparx does. Our renderer doesn't render
"products" — it renders **bindings with a cardinality contract** (scalar / object
/ array, docs/43). The moment external data lands in the resolver `root` shaped to
a declared schema, _every existing piece works unchanged_: the binding picker,
iterate/scope, the themed `@sparx/site-ui` components, the 3-tier responsive
collapse (docs/59), entrance motion (docs/61). An external Kanban sits next to a
real product grid, styled identically, on the tenant's own domain. **That
combination is the moat** — it's what Notion-as-a-connector-host can't do because
it doesn't host the rest of the platform.

### Relationship to neighboring docs

- **docs/28 (Third-Party Inventory Sync)** is the _opposite_ pattern: it **mirrors**
  an external ERP/WMS catalog **into** our DB so Commerce owns canonical rows.
  Connections do **not** mirror — they resolve live (or cached) at render time and
  keep no canonical copy. A tenant uses docs/28 when the data must be _transacted
  on_ (orders, stock decrements) and Connections when it must be _displayed_.
- **docs/60 (Marketplace)** has an "Integrations" category, and `sparx.market` is
  already earmarked as the "theme/plugin/**connector** marketplace" (docs/00). A
  Connection **template** (a pre-built, parameterized connector for a popular API)
  is a natural marketplace listing — see §13.
- **docs/53 (Tenant Components)** established the principle we reuse here:
  **declarative, versioned, parameterized — never tenant-authored code, no RCE.**
  Connection response-mapping is declarative for the same reason.

---

## 1. Terminology

- **Connection** — a tenant-owned, named definition of an external data source: its
  kind (`rest` | `graphql` | `sql`), endpoint, auth, refresh policy, and a
  **declared output schema** (fields + cardinality). The unit a tenant creates and
  manages. RLS-scoped, secrets encrypted.
- **Connection source** — the `DataSource` a Connection contributes to the Builder
  binding catalog. Key `ext.<slug>` (array) and/or `<slug>` (object), `module:
'external'`. Indistinguishable, to the author, from `cms.blog_post`.
- **Resolver** — the server-side component that executes a Connection (fetch/query),
  applies the declarative mapping, caches the result, and returns shaped data.
- **Connector proxy** — the hardened, SSRF-safe outbound HTTP/SQL client every
  Connection executes through. The single security-critical new component.
- **Connection template** — a pre-built parameterized Connection (e.g. "GitHub
  Issues", "Stripe-balance", a generic "REST JSON list") a tenant installs and
  fills in (token, repo). The marketplace unit (§13).

---

## 2. The core insight: an external source is just another `DataSource`

The binding catalog (`packages/builder-schemas/src/binding.ts`) already abstracts
_every_ bindable thing into one shape:

```ts
export interface DataSource {
  key: string; // 'ext.kanban' (list) or 'kanban' (one record)
  label: string;
  module: SourceModule; // ← add 'external'
  cardinality: SourceCardinality; // 'array' → iterate; 'object' → scope-once
  recordType: string;
  fields: FieldSchema[]; // text | number | image | date | group | list | …
}
```

`getSchema()` in `packages/builder/src/services/binding-service.ts` assembles the
page catalog by concatenating tenant CMS sources with the code-defined Commerce/CRM
constants. **The entire integration on the authoring side is one more term in that
concatenation:**

```ts
// binding-service.ts (proposed)
export function getSchema(ctx: ServiceContext): Promise<BindingCatalog> {
  return withTenant(ctx, async (tx) => {
    const cmsSources = await loadCmsSources(tx);
    const extSources = await loadConnectionSources(tx); // ← new, gated on module
    return { sources: [...cmsSources, ...extSources, ...COMMERCE_SOURCES, ...CRM_SOURCES] };
  });
}
```

`loadConnectionSources` reads the tenant's `connection` rows and maps each one's
**declared schema** to a `DataSource` (the external analogue of
`mapCmsContentType`). The Builder's binding picker, cardinality gating, scope
machinery, and editor preview consume it with zero changes.

The render side has the same shape of seam. `loadBuilderData` in
`apps/site/lib/builder-data.ts` walks the tree, computes `neededSources`, and
fetches each in parallel into the resolver `root`. We add an `ext` branch:

```ts
// builder-data.ts neededSources() (proposed) — alongside cmsTypes / commerce
if (root.startsWith('ext.')) extKeys.add(root.slice('ext.'.length).split('.')[0]);

// loadBuilderData() (proposed) — one task per external key
for (const key of extKeys) {
  tasks.push(
    resolveConnection(tenantSlug, key) // → through the proxy + cache
      .then((rows) => setAtPath(root, `ext.${key}`, rows))
      .catch(() => setAtPath(root, `ext.${key}`, [])) // degrade to empty, never crash the page
  );
}
```

`resolveConnection` calls a **new public endpoint** (sibling of
`services/api-rest/src/routes/v1/public/builder.ts`), which runs the proxy + cache
server-side. The renderer (`apps/site/components/builder-renderer.tsx`) is
**untouched**: it already iterates any array and scopes any object via
`resolvePath`/`cardinalityOf`.

> **Net new surface is small and concentrated:** a `connection` data model + CRUD,
> the **connector proxy** (the hard, security-critical part), a **resolver +
> cache**, a public **resolve endpoint**, a `loadConnectionSources` mapper, the
> two `builder-data.ts` branches, and the authoring UI. The composition, binding,
> rendering, theming, and responsive layers are **reused as-is**.

---

## 3. Data model

A tenant-scoped table, RLS `ENABLE` + `FORCE` with the standard `tenant_isolation`
policy (per the RLS pattern: hand-edit the migration SQL, Prisma won't generate
it). Secrets are **never** stored plaintext.

```
connection
  id              uuid pk
  tenant_id       uuid        -- RLS scope
  site_id         uuid null   -- optional per-site scope (docs/49); null = all sites
  slug            text        -- binding key segment: ext.<slug> ; unique per (tenant, slug)
  label           text
  kind            enum('rest','graphql','sql')
  status          enum('draft','active','error','disabled')
  module_required text        -- the module flag gating this (default 'connections')

  -- request definition (kind-specific; see §4)
  config_json     jsonb       -- url, method, query, headers (non-secret), graphql doc/vars, sql text, etc.

  -- declared output schema → the DataSource fields (the keystone)
  schema_json     jsonb       -- { rootPath, recordType, cardinality, fields: FieldSchema[] }
  mapping_json    jsonb       -- declarative field map (response path → field key); §5

  -- caching / freshness (§7)
  cache_ttl_secs  int         -- 0 = always live (SSR/no-store); >0 = cache + revalidate
  refresh_mode    enum('on_read','scheduled','webhook')
  refresh_cron    text null   -- when refresh_mode='scheduled'

  -- health
  last_ok_at      timestamptz null
  last_error      text null

  created_at / updated_at / created_by

connection_secret              -- 1..n per connection; encrypted at rest
  id / connection_id / tenant_id
  name            text         -- 'bearer', 'api_key', 'basic_user', 'basic_pass', 'sql_dsn'
  ciphertext      bytea        -- KMS/envelope-encrypted; decrypted only in the proxy
  created_at

connection_run                 -- observability ring buffer (optional, capped)
  id / connection_id / tenant_id
  started_at / duration_ms / status / row_count / bytes / error
```

**Why a declared `schema_json` rather than inferring per request:** the binding
catalog is consumed by the editor _before_ any data is fetched (to populate the
picker, gate cardinality, drive preview). The schema must be stable and known at
author time. We _infer it once_ from a sample response during authoring (§9), let
the tenant adjust, then persist it. Drift between the declared schema and live
responses degrades gracefully (missing field → empty binding).

**RLS note:** if a future migration backfills `connection` rows for existing
tenants, the backfill MUST loop tenants + `set_config('app.tenant_id', …)` —
`sparx_owner` is a non-superuser in prod and sees 0 rows otherwise (the
FORCE-RLS backfill footgun).

---

## 4. The three kinds

### 4a. `rest` (Phase 1)

```jsonc
config_json = {
  "method": "GET",                      // GET only in Phase 1
  "url": "https://api.example.com/board/123/columns",
  "query": { "limit": "50" },           // appended; values may reference no secrets directly
  "headers": { "Accept": "application/json" }, // non-secret headers only
  "auth": { "type": "bearer", "secretRef": "bearer" }, // resolved server-side
  "timeout_ms": 5000,
  "max_bytes": 1048576,                  // 1 MiB response cap
  "max_rows": 200
}
```

- **GET only** in Phase 1 (read-only display; no side effects). POST/mutations
  deferred.
- Auth types: `bearer`, `api_key` (header or query param), `basic`. The secret is
  referenced by `secretRef` and injected **only inside the proxy** — never in
  `config_json`, never sent to the client.

### 4b. `graphql` (Phase 2)

```jsonc
config_json = {
  "url": "https://api.example.com/graphql",
  "document": "query($id:ID!){ board(id:$id){ columns{ id name cards{ id title } } } }",
  "variables": { "id": "123" },
  "auth": { "type": "bearer", "secretRef": "bearer" },
  "rootPath": "data.board.columns"     // where the list lives in the response
}
```

Same proxy, POST with a JSON body, response mapped identically.

### 4c. `sql` (Phase 3 — heavily sandboxed)

The scariest kind; full spec but **last**.

- **Never** touches the Sparx Cloud SQL instance. A `sql` Connection is a
  **bring-your-own** connection string (the tenant's own DB), stored as an
  encrypted `connection_secret` (`sql_dsn`).
- Execution constraints, all enforced in the proxy:
  - a **read-only** role is required (we cannot guarantee it, so we also wrap every
    statement) — `SET TRANSACTION READ ONLY`, `statement_timeout`, a hard row cap,
    and a single-statement guard (reject `;`-chained / DDL / DML by parse).
  - the query is **parameterized**; tenant supplies `:params` bound server-side.
  - the DB host is run through the same SSRF allowlist/CIDR checks as REST (§6) —
    no `localhost`, no RFC-1918, no metadata IPs.
- If the tenant's DB is private, they expose it through their own gateway; we do
  not build a tunnel (cf. docs/28's on-prem bridge if that's ever needed).

> SQL is genuinely dangerous and rarely the first ask. **Ship REST first, measure
> demand, then decide whether SQL is worth the sandbox cost.**

---

## 5. Declarative response mapping (no code, no RCE)

Following docs/53's principle: **tenants describe the mapping, they do not write
code.** A mapping is a list of `{ field, from }` pairs plus a `rootPath` to the
array:

```jsonc
schema_json = {
  "rootPath": "columns",          // the array within the response
  "recordType": "kanbanColumn",
  "cardinality": "array",
  "fields": [
    { "key": "name",  "label": "Column", "kind": "text",   "cardinality": "scalar" },
    { "key": "cards", "label": "Cards",  "kind": "list",   "cardinality": "array",
      "fields": [
        { "key": "title", "label": "Title", "kind": "text", "cardinality": "scalar" }
      ] }
  ]
}
mapping_json = {
  "name":         "$.name",
  "cards":        "$.cards",
  "cards[].title":"$.title"
}
```

- `from` is a **restricted JSONPath / dotted pointer** — selection only, no
  expressions, no arbitrary JS. This is the whole transform surface in Phase 1.
- Type coercion is declared by `kind` (a numeric string → number, an ISO string →
  formatted date, a URL string → `{ url, alt }` for `image`). Same coercion table
  the CMS mapper uses (`mapField`).
- Nested `list`/`group` fields recurse, exactly like CMS repeater/object fields —
  which is what makes the nested Kanban (columns → cards) work.
- **Future (Phase 2+):** a small, sandboxed, _pure_ expression dialect (no I/O, no
  loops over network) if selection proves too limiting. Never `eval`.

---

## 6. Security — the connector proxy (the make-or-break component)

User-supplied URLs/hosts are the #1 way a feature like this becomes a breach
(SSRF → cloud metadata → cluster credentials). Per the OWASP SSRF cheat sheet, the
proxy is built **allowlist-first** and runs in **isolation**:

1. **Scheme allowlist** — `https` only (Phase 1). No `http`, `file`, `gopher`,
   `ftp`, `data`.
2. **Host/IP denylist by resolution** — resolve the host, reject if it lands in
   `127.0.0.0/8`, `10/8`, `172.16/12`, `192.168/16`, `169.254/16` (incl.
   `169.254.169.254` metadata), `::1`, ULA/link-local, and the cluster's own
   service CIDRs.
3. **Re-resolve DNS on every redirect hop** (defeat DNS-rebinding / redirect-to-
   internal). Cap redirects; re-run the IP check each hop. Or simply **disable
   redirects** in Phase 1.
4. **IMDSv2 enforced** on the nodes (`HttpTokens=required`, hop limit 2) so even a
   bypass can't read instance metadata — mirror this into Terraform (no drift).
5. **Network isolation** — the proxy egresses from a **dedicated, restricted**
   path (its own NEG/egress policy), not from a pod with broad cluster reach.
   Defense-in-depth behind the app checks.
6. **Resource caps** — connect + total timeout, max response bytes, max rows,
   max concurrent fetches per tenant. A slow/huge upstream cannot exhaust us.
7. **Secrets stay server-side** — decrypted only inside the proxy, attached to the
   outbound request, never logged, never returned to the client.
8. **The browser never names a URL.** The public resolve endpoint (§8) takes a
   **connection slug**, not a URL. Arbitrary-URL input exists _only_ on the
   authenticated authoring path (tenant admin), and even there it runs the full
   validation above before the Connection can be saved/activated.

> The authoring path and the render path have **different threat models**: authoring
> is an authenticated admin setting a URL (validated, rate-limited, logged); render
> is anonymous traffic that can only reference an already-vetted Connection by key.
> Keeping these separate is what makes the live path safe.

---

## 7. Freshness: caching, render modes, and refresh

Three render modes, mapping onto the existing Next.js 16 render path
(`apps/site` already tags fetches, e.g. `publicGet(..., { tag })`):

| Mode                   | `cache_ttl_secs` | How                                                                                                                                                                                               | Use for                                                                       |
| ---------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| **Cached (default)**   | `> 0`            | Proxy result cached in the **Phase-1 Redis pod** keyed by `(tenant, connection, params)` with TTL; page fetch tagged for on-demand revalidation. Fast, SEO-safe, rate-limit-safe.                 | Most data — directories, catalogs, feeds that change minutely/hourly.         |
| **SSR / live-on-read** | `0`              | Fetch through the proxy per request (`cache: 'no-store'`).                                                                                                                                        | Data that must be current at page load and is low-traffic.                    |
| **Client live**        | n/a              | A small **client island** calls the public resolve endpoint on an interval (or SSE later). The endpoint is still server-proxied + short-TTL cached, so a hot page collapses to one upstream call. | Genuinely real-time widgets (a moving Kanban, a live score). Opt-in per node. |

**Refresh strategy** ties into the existing event model — never inline side
effects in the request:

- `on_read` — lazy; cache fills on first miss, TTL expiry triggers refetch.
- `scheduled` — a Cloud Run worker (the `cloud-run-worker` TF module) polls on
  `refresh_cron`, warms the cache, publishes `connection.refreshed`.
- `webhook` — an inbound endpoint `POST /v1/connections/:slug/refresh` (HMAC-
  verified) lets the upstream push-invalidate; we revalidate the cache + the
  page's Next tag. This is the lowest-latency, lowest-cost option.

**Rate-limit & cost guards:** per-connection cache collapses concurrent misses
(single-flight), a per-tenant outbound budget, and circuit-breaking on repeated
upstream failures (flip `status='error'`, serve last-good or empty, surface in the
dashboard).

---

## 8. API surface

**Authoring (authenticated, `write:connections` / `read:connections`):**

```
GET    /v1/connections                      list (tenant-scoped, RLS)
POST   /v1/connections                      create (draft)
GET    /v1/connections/:id
PUT    /v1/connections/:id                   update config/schema/mapping
POST   /v1/connections/:id/sample            run once, return raw + inferred schema (authoring aid)
POST   /v1/connections/:id/test              dry-run through the proxy, return shaped rows + timing
POST   /v1/connections/:id/activate          draft → active (after a green test)
DELETE /v1/connections/:id                   (confirmation-gated; behind useConfirm)
PUT    /v1/connections/:id/secrets/:name     set/rotate a secret (encrypted; write-only)
```

**Public render (anonymous, slug-addressed — no URL, no secret):**

```
GET  /v1/public/connections/resolve?tenant=<slug>&connection=<slug>[&params...]
POST /v1/connections/:slug/refresh           inbound webhook (HMAC), cache-invalidate
```

The resolve endpoint is the **only** thing the site/island ever calls for
external data; it enforces module gating, runs the proxy + cache, and returns
shaped rows. It accepts a **bounded, declared** param allowlist (from
`config_json`) — never arbitrary query passthrough.

All of this is API-first (a Connection is fully usable headless); the dashboard UI
and MCP are consumers.

---

## 9. Authoring UX

A new **Connections** area in the dashboard (gated on the module). The flow is
designed to keep the "infer, don't make me type a schema" ergonomic that makes
this feel magical:

1. **New Connection** → pick kind, enter endpoint + auth (secret captured into the
   encrypted store immediately, shown masked thereafter).
2. **Sample** → the server runs one request through the proxy and returns the raw
   response + an **inferred schema** (array root detection, field kinds from
   value types). The classic "paste an endpoint, watch it populate" moment.
3. **Map & adjust** → confirm the root path, rename/retype fields, mark the
   image/date/number kinds, drop fields. Declarative — a field grid, no code.
4. **Cache & refresh** → choose a render mode + TTL/cron/webhook.
5. **Test** → green dry-run required before **Activate**.

Once active, the Connection appears in the Builder binding picker under an
**"External"** group, beside CMS and Commerce. The author binds exactly as they do
today (docs/43): bind a container to `ext.kanban` (array → iterates columns),
nest a Stack bound to `item.cards` (array → iterates cards), each card a themed
`<Card>` with Text bound to `item.title`.

**Responsiveness & destructive-action rules apply unchanged:** the rendered output
collapses via the 3-tier model (docs/59); deleting a Connection that pages bind to
goes behind a `useConfirm` that names the dependent pages (the delete-impact
pattern from docs/53).

---

## 10. MCP surface

Per MCP-native + API-first, AI authors Connections too. New write-tools alongside
the page tools in `packages/builder/src/mcp/write-tools.ts`:

- `create_connection` / `update_connection` (`write:connections`)
- `sample_connection` (`read:connections`) — infer schema from a live response
- `activate_connection` (confirmation-gated)
- `delete_connection` (confirmation-gated)

The vocabulary guide (`packages/builder/src/mcp/vocabulary.ts`) gains a section on
binding `ext.*` sources so the model authors pages against external data correctly.
This lets a prompt like _"add a live Kanban from this API to my homepage"_ become:
create the Connection → sample → map → activate → author the bound subtree, all
through MCP.

---

## 11. Worked example — the Kanban board

1. Tenant creates a `rest` Connection `kanban` → `GET
https://pm.example.com/boards/42/columns`, bearer token stored encrypted.
2. **Sample** returns `{ columns: [{ name, cards: [{ title }] }] }`; the inferred
   schema is confirmed: `rootPath: columns`, an array of `{ name: text, cards:
list<{ title: text }> }`.
3. Render mode **client live**, TTL 15s (board moves in real time).
4. In the Builder, the author drops a horizontal Grid bound to `ext.kanban`
   (array → one column per item), inside it a Stack bound to `item.cards` (array →
   one card per item), each card a `<Card>` containing a Text bound to
   `item.title`. All themed with the tenant's tokens.
5. On the published site, a client island polls
   `/v1/public/connections/resolve?tenant=…&connection=kanban` every 15s; the
   server proxies + short-caches; the renderer re-runs the existing iterate/scope
   path. The board looks native, lives on the tenant's domain, and required **zero
   new rendering primitives**.

---

## 12. Module gating & billing

- A new **Connections** module flag (modules-not-plans: gate on the module, never
  a tenant plan). Disabled → the binding catalog omits `ext.*`, the resolve
  endpoint 404s, no refresh workers run, no rows stored — the standard
  event-driven `module.activated` lifecycle.
- Pricing slots into the flat per-module marketing model (a Builder-adjacent
  capability; price TBD with the pricing sweep). Metering candidates: number of
  active Connections and/or monthly resolve volume — but **start with a flat
  price** and add metering only if cost demands it (start-cheap ethos).

---

## 13. Marketplace: Connection templates

`sparx.market` is already earmarked as the connector marketplace (docs/00), and
docs/60 has an Integrations category. A **Connection template** is a pre-built,
parameterized Connection (request + schema + mapping) for a popular API — the
tenant installs it and fills in only the variables (token, board id):

- Mirrors the Tenant-Component model (docs/53): declarative, versioned,
  parameterized, **system-owned → copied into the tenant**, no code.
- Pairs naturally with a Tenant-Component template that consumes it (e.g. a
  "Kanban Board" component bound to a "Kanban" Connection) so installing both
  drops a working, themed widget onto a page in one step — adjacent to the
  Blueprints one-click provisioning (docs/54).
- This is the long-tail growth engine: the platform ships a handful of first-party
  connectors; the marketplace lets the ecosystem add the rest **without a deploy**.

---

## 14. Phasing

Consistent with deploy-early / start-cheap: ship the smallest end-to-end slice
that renders the Kanban demo, then widen.

- **Phase 1 — REST GET, the capstone MVP.** `rest` kind, GET only, `https` only,
  the hardened proxy + SSRF guards, encrypted secrets, sample/infer authoring,
  declarative mapping, Redis-cached + on-read/scheduled refresh, the binding-catalog
  - `builder-data.ts` seams, the public resolve endpoint, the dashboard Connections
    area, MCP tools. Renders the Kanban end-to-end (cached + client-live modes).
- **Phase 2 — GraphQL + push.** `graphql` kind; client-live SSE; webhook-in
  refresh; optional sandboxed pure-expression mapping; marketplace Connection
  templates.
- **Phase 3 — SQL.** `sql` kind, bring-your-own DSN, full read-only sandbox; only
  if Phase 1/2 demand proves it out.
- **Phase 4 — write-back (maybe).** Actions that POST to a Connection (form
  submit, "move card") — a different threat model (CSRF, idempotency, auth on
  behalf of). Explicitly **out of scope** until display is proven and demanded.

---

## 15. Open questions

- **Per-site vs per-tenant scope.** `site_id` is in the model; default to tenant-
  wide, allow per-site? (Ties into docs/49 multi-property scoping.)
- **Pagination & infinite lists.** Phase 1 caps rows; do we expose cursor/offset
  params for "load more" client-side later?
- **PII / compliance.** External data may carry PII; do we need a tenant
  acknowledgement + a "do not cache" flag for sensitive sources?
- **Field-level transforms.** Is restricted JSONPath enough, or is a sandboxed
  expression dialect needed in Phase 1 for date/number/currency shaping beyond the
  `kind` coercion table?
- **Email surface.** External sources in the **Email** catalog (docs/52) too (an
  email iterating an external feed), or pages only at first? (Per-recipient
  personalization interplay needs thought.)
- **Cost ceilings.** Per-tenant outbound budget and the upgrade trigger that moves
  the resolve cache off the Redis pod (docs/21).

---

## 16. File-level extension map

The concrete seams (all additive; the composition/render/theming layers are
untouched):

| Concern            | File                                                       | Change                                                                                          |
| ------------------ | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| New source module  | `packages/builder-schemas/src/binding.ts`                  | `SourceModule` += `'external'`; a `mapConnection()` (external analogue of `mapCmsContentType`). |
| Catalog assembly   | `packages/builder/src/services/binding-service.ts`         | `loadConnectionSources(tx)`; merge into `getSchema` (gated on module).                          |
| Render-time fetch  | `apps/site/lib/builder-data.ts`                            | `neededSources` `ext.` branch + a resolve task in `loadBuilderData`.                            |
| Public resolve     | `services/api-rest/src/routes/v1/public/`                  | New `connections.ts` resolve endpoint (sibling of `builder.ts`).                                |
| Connector proxy    | `packages/` (new, e.g. `@sparx/connectors`)                | SSRF-safe fetch/SQL client, declarative mapper, cache, single-flight.                           |
| Data model         | `packages/db`                                              | `connection`, `connection_secret`, `connection_run` + hand-written RLS migration SQL.           |
| Authoring API      | `services/api-rest/src/routes/v1/connections.ts`           | CRUD + sample/test/activate + secret rotation.                                                  |
| Refresh worker     | `services/` (Cloud Run) + Terraform topic/sub              | scheduled/webhook refresh; publishes `connection.refreshed`.                                    |
| Renderer           | `apps/site/components/builder-renderer.tsx`                | **No change** — iterate/scope already generic.                                                  |
| Client-live island | `apps/site/components/` (new)                              | polls the resolve endpoint for live mode.                                                       |
| MCP                | `packages/builder/src/mcp/write-tools.ts`, `vocabulary.ts` | `*_connection` tools + `ext.*` authoring guidance.                                              |
| Dashboard UI       | `apps/dashboard/app/(dashboard)/connections/` (new)        | Connections area; binding picker "External" group.                                              |
