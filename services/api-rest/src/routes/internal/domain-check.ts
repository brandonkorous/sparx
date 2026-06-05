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
  'api.sparx.works',
  'mcp.sparx.works',
  'graphql.sparx.works',
  // sparx.zone apex (tenant *.sparx.zone subdomains are checked via
  // `domains` table in Phase 2)
  'sparx.zone',
  'www.sparx.zone',
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
