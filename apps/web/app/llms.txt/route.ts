// llms.txt — the AI-readable index of the marketing site (docs/50).
//
// The llms.txt convention (llmstxt.org) gives answer engines and coding agents a
// curated, link-first map of a site in Markdown: an H1, a one-line summary
// blockquote, then sections of annotated links. We build it from the same
// `MODULES` source the marketing pages and sitemap use, so it can never drift
// from the live module set.

import { MODULES, MODULE_ORDER } from '@/lib/modules';
import { DOC_PAGES } from '@/lib/docs';
import { TOOLS } from '@/components/marketing/tools/registry';

export const dynamic = 'force-static';

const BASE = 'https://sparx.works';

const PLATFORM_LINKS: { path: string; label: string; note: string }[] = [
  { path: '/about', label: 'About WizeWorks', note: 'The team behind sparx — Visalia, CA.' },
  { path: '/enterprise', label: 'Enterprise', note: 'B2B, fleet, and high-volume deployments.' },
  {
    path: '/hosting',
    label: 'Managed hosting',
    note: 'On-call infrastructure support for production stores.',
  },
  {
    path: '/security',
    label: 'Security',
    note: 'Row-level multi-tenancy, data ownership, backups, SLAs.',
  },
  {
    path: '/migrate',
    label: 'Migrate to sparx',
    note: 'Native importers for Shopify, HubSpot, Mailchimp, WordPress.',
  },
  {
    path: '/marketplace',
    label: 'Marketplace',
    note: 'Integrations and add-ons for the platform.',
  },
  { path: '/themes', label: 'Themes', note: 'Starter storefront themes for the Builder.' },
  { path: '/open-source', label: 'Open source', note: "What's open about the sparx stack." },
  { path: '/contact', label: 'Contact', note: 'Talk to the team — no high-pressure demos.' },
];

export function GET(): Response {
  const moduleLines = MODULE_ORDER.map((key) => {
    const m = MODULES[key];
    return `- [sparx ${m.label}](${BASE}/${m.slug}): ${m.description}`;
  }).join('\n');

  const platformLines = PLATFORM_LINKS.map(
    (l) => `- [${l.label}](${BASE}${l.path}): ${l.note}`
  ).join('\n');

  const docLines = DOC_PAGES.map((p) => `- [${p.title}](${BASE}${p.href})`).join('\n');

  const toolLines = TOOLS.map((t) => `- [${t.name}](${BASE}/tools/${t.slug}): ${t.tagline}`).join(
    '\n'
  );

  const body = `# sparx

> sparx (by WizeWorks) is a modular content and commerce operating system: storefront, commerce, CRM, CMS, email, B2B/wholesale, dropship, and a first-class AI/MCP integration in one platform. Tenants activate only the modules they need — a CMS-only publisher, a CRM-only team, and a B2B distributor are all equally first-class.

sparx is content AND/OR commerce — selling is one capability, never the assumption. It is API-first: every feature exists as an API endpoint, and a native Model Context Protocol (MCP) server lets AI agents read and write live business data directly (no exports, no CSVs). Modules are feature-flagged and billed independently. The platform runs on Google Kubernetes Engine with PostgreSQL row-level security enforcing tenant isolation.

## Modules

${moduleLines}

## Platform

${platformLines}

## Free tools

Free, browser-based utilities for founders and small teams. Each runs entirely client-side (nothing uploaded), needs no sign-up, and is the front door to the matching sparx module. Index at ${BASE}/tools.

${toolLines}

## Documentation

Developer documentation — guides, REST & GraphQL API reference, SDKs, and the MCP server. The canonical developer home is ${BASE}/docs.

${docLines}

## More

- [Changelog](${BASE}/changelog): What shipped recently.
- [Brand](${BASE}/brand): The sparx brand and design language.
- [Terms](${BASE}/legal/terms): Platform terms of service.
- [Privacy](${BASE}/legal/privacy): Platform privacy policy.
- [Sitemap](${BASE}/sitemap.xml): Full machine-readable URL index.
`;

  return new Response(body, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
    },
  });
}
