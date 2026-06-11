# Integration submission

An **integration** connects a Sparx tenant to an external service. The
open-submission contract is the **declarative connector tier**: configuration only
— auth, resources (endpoints + field mappings), and webhooks. The platform's own
HTTP client runs it inside the tenant's context. **The submitter ships no code.**

> Integrations that need real custom logic — a new payment, shipping, or tax
> **provider** implementing the typed framework interfaces — are a separate,
> **sandboxed code tier**, reviewed and run in isolation. They are not part of this
> declarative contract. See the design doc.

## Bundle

```
acme-crm/
  sparx.json       # category: "integration"; facets: kind, scopes[]
  integration.ts   # exports the connector (auth, configSchema, resources, webhooks)
  media/
    logo.svg       # the provider's logo (card image)
  README.md
```

## Payload contract (`integration.ts`)

- **`kind`** — `data` for the declarative tier (`payments | shipping | tax` denote
  the sandboxed code tier and are not accepted here).
- **`transport`** — `rest | graphql`; **`baseUrl`**.
- **`auth`** — `apiKey | bearer | basic | oauth2`; names the secret (never inlines it).
- **`configSchema`** — the connect-form fields; `kind: secret` fields are write-only
  and stored in the secret manager.
- **`resources`** — each becomes an `ext.<id>` data source for the builder, with a
  `list` (and optional `get`/`create`/`update`) endpoint and a `fields` map onto
  stable names.
- **`webhooks`** — verified by shared secret/HMAC, republished onto the tenant bus.

## What gets checked

- Parses against the connector schema; `baseUrl` is https; no inline secrets; every
  `secret` reference resolves to a `configSchema` field.
- Static analysis confirms there is **no executable code path** — declarative only.
- Allow-list: only the files above.

## Connect

On approval the connector is stored on the catalog row. **Connect** renders the
`configSchema` form, stores secrets encrypted, and the resources/webhooks go live —
no deploy.
