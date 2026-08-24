# sparx Domain Portfolio

**Version:** 1.4
**Author:** Brandon Korous
**Last Updated:** 2026-08-23

Current registrations (all in Cloudflare DNS):

## Platform — sparx.works

| Hostname             | Purpose                                      |
| -------------------- | -------------------------------------------- |
| `sparx.works`        | Public marketing site (SSG/ISR, edge-cached) |
| `app.sparx.works`    | Tenant dashboard (authenticated Next.js)     |
| `api.sparx.works`    | REST + GraphQL API                           |
| `mcp.sparx.works`    | MCP server (AI integration)                  |
| `status.sparx.works` | Status page                                  |

## Piggles — the sister brand

Same cluster, same ingress IP, same Caddy, and — for the two API planes — the same
pods. **Three registrable domains, deliberately:** they cannot share a cookie, which
is what makes `getpiggles.com` the sole auth authority and lets `mypiggles.com` carry
no sign-in page at all.

| Hostname            | Purpose                                                                                                                                                                                                        |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `meetpiggles.com`   | Public marketing site (`piggles-web`)                                                                                                                                                                          |
| `getpiggles.com`    | Sign-up, sign-in, billing — **the auth authority** (`piggles-account`)                                                                                                                                         |
| `mypiggles.com`     | The console a business operates in (`piggles-console`)                                                                                                                                                         |
| `api.mypiggles.com` | The same api-rest the sparx apps use, on a hostname that is not another company's — the console hands this origin to the customer's own browser                                                                |
| `mcp.mypiggles.com` | The same api-mcp, likewise. The most **visible** address the brand owns: a customer copies it by hand into Claude or ChatGPT, and it also decides where they authenticate (see [07 §5](07-mcp-server-spec.md)) |

A brand-shared address is not a cosmetic detail on either of the last two rows —
each is something a Piggles customer reads. What is deliberately **not** done yet is
media: api-rest mints variant URLs server-side from one `MEDIA_PUBLIC_URL`, so a
Piggles product image still resolves through `media.sparx.works`. Giving Piggles its
own needs a per-brand value threaded through the media path — a real change, not a
routing line — so it is flagged rather than half-done (`piggles/STATUS.md`).

## Piggles tenant sites — piggles.site

| Hostname                 | Purpose                                                 |
| ------------------------ | ------------------------------------------------------- |
| `*.piggles.site`         | Tenant subdomain sites (`acme.piggles.site`)            |
| `customers.piggles.site` | CNAME target for tenant custom domains                  |
| `piggles.site`           | Apex 301s to meetpiggles.com (not a destination itself) |

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

> **Docs live on `sparx.works/docs`, not `sparx.software`.** Developer documentation is the strongest organic-backlink earner we have (API references get linked from forums, READMEs, tutorials), so it stays on the primary domain to consolidate link equity rather than splitting it across a second site. `sparx.software` is kept as a permanent 301 funnel + defensive hold — not a future standalone destination. The docs framework lives in `sparx/apps/web/app/docs/` (registry: `sparx/apps/web/lib/docs.ts`).

## Not acquired

- `sparx.mx` — original plan for Postal sending; already registered to a third party. Replaced by `sparx.email`.
