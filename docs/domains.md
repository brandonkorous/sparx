# Sparx Domain Portfolio

**Version:** 1.3
**Author:** Brandon Korous
**Last Updated:** 2026-06-05

Current registrations (all in Cloudflare DNS):

## Platform — sparx.works

| Hostname             | Purpose                                      |
| -------------------- | -------------------------------------------- |
| `sparx.works`        | Public marketing site (SSG/ISR, edge-cached) |
| `app.sparx.works`    | Tenant dashboard (authenticated Next.js)     |
| `api.sparx.works`    | REST + GraphQL API                           |
| `mcp.sparx.works`    | MCP server (AI integration)                  |
| `status.sparx.works` | Status page                                  |

## Tenant sites — sparx.zone

Shopify-style split: tenant content lives on a different registrable domain from the platform brand. Keeps reputation, cookies, and SEO cleanly isolated.

| Hostname               | Purpose                                             |
| ---------------------- | --------------------------------------------------- |
| `*.sparx.zone`         | Tenant subdomain sites (`acme.sparx.zone`)          |
| `customers.sparx.zone` | CNAME target for tenant custom domains              |
| `sparx.zone`           | Apex 301s to sparx.works (not a destination itself) |

## Email — sparx.email

Postal sending infrastructure **and** platform-to-tenant transactional emails. `sparx.mx` was the original plan; it was unavailable, so `sparx.email` plays both roles.

| Hostname           | Purpose                                 |
| ------------------ | --------------------------------------- |
| `mail.sparx.email` | Postal SMTP ingress                     |
| `sparx.email`      | SPF, DKIM, DMARC, MX → mail.sparx.email |

## Module marketing sites

Each module has its own marketing/landing domain — independent SEO channels.

| Domain           | Module          |
| ---------------- | --------------- |
| `sparxcms.com`   | CMS             |
| `sparxcrm.com`   | CRM             |
| `sparxemail.com` | Email           |
| `sparxb2b.com`   | B2B / Wholesale |

## Future / placeholder

Currently 301-redirect to the corresponding section on `sparx.works`. Replaced with real sites as the products mature.

| Domain           | Eventual purpose                           | Today                     |
| ---------------- | ------------------------------------------ | ------------------------- |
| `sparx.host`     | Managed hosting product marketing          | 301 → sparx.works/hosting |
| `sparx.software` | Developer-brand funnel (**permanent** 301) | 301 → sparx.works/docs    |
| `sparx.market`   | Theme/plugin/connector marketplace         | 301 → sparx.works/market  |
| `sparx.exchange` | Defensive registration                     | 301 → sparx.works         |

> **Docs live on `sparx.works/docs`, not `sparx.software`.** Developer documentation is the strongest organic-backlink earner we have (API references get linked from forums, READMEs, tutorials), so it stays on the primary domain to consolidate link equity rather than splitting it across a second site. `sparx.software` is kept as a permanent 301 funnel + defensive hold — not a future standalone destination. The docs framework lives in `apps/web/app/docs/` (registry: `apps/web/lib/docs.ts`).

## Not acquired

- `sparx.mx` — original plan for Postal sending; already registered to a third party. Replaced by `sparx.email`.
