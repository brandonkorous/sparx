// Caddy on-demand TLS ask endpoint (docs/04-domain-ssl-automation.md §3.4).
//
// Caddy hits this before issuing a Let's Encrypt cert for an incoming HTTPS
// hostname. We answer 200 → allow, anything else → deny. Caddy refuses to
// mint the cert on a denial, which is the only thing standing between us
// and a wildcard cert factory for any attacker who can DNS a hostname at us.
//
// Phase 1 policy:
//   - Allow the static platform hostnames (sparx.works + its subs, the
//     module marketing domains, sparx.email, sparx.zone apex).
//   - Deny everything else — `*.sparx.zone` tenant subdomains and tenant
//     custom domains land here too, but until the `domains` table exists
//     there's no way to authorize them. They'll fail to issue a cert,
//     which is the safe default.
//
// Phase 2 policy (docs/49 §5): every non-platform host is authorized by
// `resolveSiteByHost` (lib/domain.ts) — one source of truth shared with the
// storefront. It covers BOTH a connected custom domain (a verified/active row
// in the `domains` table) AND a `*.sparx.zone` subdomain (an exact domains row,
// or the bare `<tenant>.sparx.zone` fallback resolved via the tenants table).
// This is what powers preview URLs from the dashboard and tenants on their own
// custom domains alike.
//
// Not in OpenAPI, no auth, no rate-limit interference — this is an internal
// ClusterIP-only endpoint. Caddy hits it at most every 2 minutes per host
// (the Caddyfile `interval`), so there's nothing to throttle here.

import type { FastifyPluginAsync } from 'fastify';
import { isHostAuthorized } from '../../lib/domain.js';

const PLATFORM_HOSTNAMES = new Set<string>([
    // sparx.works
    'sparx.works',
    'www.sparx.works',
    'app.sparx.works',
    // workbench.sparx.works — the multi-window workbench app. Without this entry
    // on-demand TLS is denied and Cloudflare 525s the whole app.
    'workbench.sparx.works',
    'api.sparx.works',
    'mcp.sparx.works',
    'graphql.sparx.works',
    // media.sparx.works — public CDN host for media variants + marketplace item
    // imagery (Caddyfile routes it to api-rest). Without this entry on-demand TLS
    // is denied and Cloudflare returns 525 on every media URL (docs/85).
    'media.sparx.works',
    // media-direct.sparx.works — the SAME media routes on a DNS-only (NOT
    // Cloudflare-proxied) host. Instagram/Threads/Pinterest fetch a post's image_url
    // from here so they never hit Cloudflare's 206-on-Range (which they reject,
    // dropping the image). On-demand issuance lands directly on the pod (grey-cloud),
    // but still calls this ask endpoint, so it must be allow-listed like media.sparx.works.
    'media-direct.sparx.works',
    // sparx.zone apex (tenant *.sparx.zone subdomains are checked via
    // `domains` table in Phase 2)
    'sparx.zone',
    'www.sparx.zone',
    // mcp.sparx.zone — the canonical shopper-facing site-MCP host (docs/113).
    // A reserved slug, so no tenant owns it; resolveSiteByHost can't authorize it,
    // so it must be a static platform host or on-demand TLS would 403 it. Caddy
    // routes it to the mcp-site service (site named via the /s/<tenant> path).
    'mcp.sparx.zone',
    // sparx.email — apex + Postal infra hostnames. `postal.sparx.email`
    // is the admin UI (Caddy → postal-web ClusterIP). `mail.sparx.email`
    // is the SMTP banner hostname Postal advertises; Caddy doesn't
    // terminate TLS for it (Postal speaks STARTTLS on :25 directly) but
    // we keep it in the list in case future tooling lands behind Caddy.
    'sparx.email',
    'www.sparx.email',
    'postal.sparx.email',
    'mail.sparx.email',
    // module marketing
    'sparxcms.com',
    'www.sparxcms.com',
    'sparxcrm.com',
    'www.sparxcrm.com',
    'sparxemail.com',
    'www.sparxemail.com',
    'sparxb2b.com',
    'www.sparxb2b.com',
    // sister zones (Caddy redirects these in the Caddyfile, but it still
    // needs a cert to terminate TLS before redirecting)
    'sparx.host',
    'www.sparx.host',
    'sparx.software',
    'www.sparx.software',
    'sparx.market',
    'www.sparx.market',
    'sparx.exchange',
    'www.sparx.exchange',
    // silicaui.com — first-party marketing + docs site, a co-tenant in the
    // `silicaui` namespace (static Next.js export served by nginx). It is NOT a
    // sparx tenant property, so resolveSiteByHost can't authorize it; it has to be
    // a static platform host here or on-demand TLS 403s it. On-demand (rather than
    // kanNINJA-style explicit managed blocks) is deliberate: the shared Caddy is a
    // single replica on a Recreate rollout, so every boot has a ~15-60s window with
    // no registered LB backend, and certmagic fires all its startup issuance
    // attempts inside it — a first cert can never be obtained at boot. On-demand
    // defers issuance to the first HTTPS request, which lands on the warm,
    // LB-registered pod, so the challenge succeeds and renewals (also request/
    // maintenance time, never boot) stay healthy.
    'silicaui.com',
    'www.silicaui.com',
    // ── Piggles ──────────────────────────────────────────────────────────────
    // The sister brand's three surfaces + its api-rest hostname. They are PLATFORM
    // hosts, not tenant sites, so `isHostAuthorized` below cannot vouch for them —
    // it resolves against the `domains` table and these have no row there and
    // never will.
    //
    // Without these entries the failure is total and looks like nothing to do with
    // this file: their Caddy blocks `import tls_policy`, which is `tls { on_demand }`
    // (k8s/ingress/mode.caddy), so every first HTTPS request asks this endpoint,
    // gets 403 unknown_host, and Cloudflare answers 525 — for the whole brand.
    // That is exactly what happened to `workbench.sparx.works` and
    // `media.sparx.works`, both of which are in this list for the same reason.
    'meetpiggles.com',
    'www.meetpiggles.com',
    'getpiggles.com',
    'www.getpiggles.com',
    'mypiggles.com',
    'www.mypiggles.com',
    'api.mypiggles.com',
    // The tenant zone's apex + www, which Caddy redirects to meetpiggles.com but
    // must still terminate TLS for. Tenant sites UNDER it (`<slug>.piggles.site`)
    // are deliberately absent: those are real tenant hosts with `domains` rows and
    // are authorised by the resolver below, per brand, exactly like *.sparx.zone.
    'piggles.site',
    'www.piggles.site',
    // ── jotDOJO ──────────────────────────────────────────────────────────────
    // A THIRD product sharing this cluster, living in a repository of its own, in
    // its own `jotacular` namespace with its own database and its own pipeline.
    // api-rest serves it nothing — these entries exist ONLY so Caddy may mint
    // certificates for its four hostnames.
    //
    // That is worth stating plainly, because this list is the one place a product
    // sparx knows nothing about has to appear in sparx's code: its Caddy blocks
    // `import tls_policy`, which is `tls { on_demand }`, so every first HTTPS
    // request for these names asks THIS endpoint. Without a match here the
    // resolver below is consulted, finds no `domains` row (there will never be
    // one — jotDOJO is not a sparx tenant), returns 403 `unknown_host`, and
    // Cloudflare answers 525 for the entire product.
    //
    // Routing lives in k8s/ingress/Caddyfile; the Azure side is
    // terraform/envs/azure/jotacular.tf.
    // FIVE names, not four. `app.jotacular.com` is the PWA and the apex is the
    // marketing site — the same Deployment, split on Host inside the app — so the
    // apex being present here says nothing about `app.` being covered. Missing it
    // 525s the application while the marketing site loads perfectly, which reads
    // like an app outage rather than a TLS allow-list omission.
    'jotacular.com',
    'www.jotacular.com',
    'app.jotacular.com',
    'api.jotacular.com',
    'mcp.jotacular.com',
]);

const domainCheckRoutes: FastifyPluginAsync = (app) => {
    app.get<{ Querystring: { domain?: string } }>(
        '/internal/domain-check',
        {
            logLevel: 'warn',
            // Keep this route out of the public OpenAPI spec — it's a Caddy
            // internal contract, not a customer-facing endpoint.
            schema: { hide: true },
        },
        async (request, reply) => {
            const host = (request.query.domain ?? '').toLowerCase().trim();

            if (!host) {
                return reply.code(400).send({ allowed: false, reason: 'missing_domain' });
            }

            if (PLATFORM_HOSTNAMES.has(host)) {
                return reply.code(200).send({ allowed: true, source: 'platform' });
            }

            // Tenant sites: custom domains + `*.sparx.zone` subdomains, both resolved
            // by the shared host→property resolver. A routable host (active tenant +
            // non-archived property) is authorized to mint a cert.
            const route = await isHostAuthorized(host);
            if (route) {
                return reply
                    .code(200)
                    .send({ allowed: true, source: 'tenant_site', tenantId: route.tenantId });
            }

            return reply.code(403).send({ allowed: false, reason: 'unknown_host' });
        }
    );
    return Promise.resolve();
};

export default domainCheckRoutes;
