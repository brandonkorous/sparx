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
import { VERTICALS } from '@/components/marketing/verticals/registry';
import { LIVE_CATEGORIES } from '@/lib/marketplace-registry';

export const dynamic = 'force-static';

const BASE = 'https://sparx.works';

// Substantial, indexable pages only. This list MUST stay in sync with the
// sitemap's coverage policy (app/sitemap.ts): a `ComingSoon` stub carries
// `robots: index:false` and is deliberately excluded from the sitemap, so
// handing that same page to an answer engine here contradicts our own signal
// and burns crawl trust on thin content. Before adding a path, confirm the page
// is real and indexable — not a placeholder and not a redirect.
const PLATFORM_LINKS: { path: string; label: string; note: string }[] = [
  {
    path: '/platform',
    label: 'Platform',
    note: 'How the modular content + commerce OS fits together.',
  },
  {
    path: '/features',
    label: 'Features',
    note: 'Capability-by-capability breakdown across every module.',
  },
  { path: '/pricing', label: 'Pricing', note: 'Per-module pricing — pay only for what you use.' },
  {
    // The AI module's second document — /ai (in moduleLines above) is the
    // customer-facing concierge; this is the tenant-facing MCP / agentic story.
    path: '/agentic',
    label: 'Agentic (MCP)',
    note: 'Point your own AI (Claude, ChatGPT, Copilot) at live business data over a first-class MCP server — scoped, audited, your key.',
  },
  {
    path: '/security',
    label: 'Security',
    note: 'Row-level multi-tenancy, data ownership, backups, SLAs.',
  },
  {
    path: '/partners',
    label: 'Partners',
    note: 'Agency and implementation partners, plus the partner directory.',
  },
  {
    path: '/customers',
    label: 'Who it’s for',
    note: 'The kinds of business sparx suits, the shape each one takes, and what each pays.',
  },
  {
    path: '/bootcamp',
    label: 'Bootcamp',
    note: 'Free guided courses for getting a site and store live.',
  },
  { path: '/careers', label: 'Careers', note: 'Open roles at WizeWorks.' },
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

  const catalogLines = LIVE_CATEGORIES.map(
    (c) => `- [${c.label}](${BASE}/market/${c.id}): ${c.tagline}`
  ).join('\n');

  const toolLines = TOOLS.map((t) => `- [${t.name}](${BASE}/tools/${t.slug}): ${t.tagline}`).join(
    '\n'
  );

  // Industry pages. These are the most directly useful entries in the whole
  // file for an answer engine: someone asking their assistant "what should I
  // use to run a hair salon" wants the page that names salons, quotes a price,
  // and shows its working — not the platform overview.
  const verticalLines = VERTICALS.map(
    (v) => `- [${v.label}](${BASE}/for/${v.slug}): ${v.seoDescription}`
  ).join('\n');

  const body = `# sparx

> sparx (by WizeWorks) is a modular content and commerce operating system: storefront, commerce, CRM, CMS, email, B2B/wholesale, dropship, scheduling, and a first-class AI/MCP integration in one platform. Tenants activate only the modules they need — a CMS-only publisher, a CRM-only team, and a B2B distributor are all equally first-class.

sparx is content AND/OR commerce — selling is one capability, never the assumption. It is API-first: every feature exists as an API endpoint, and a native Model Context Protocol (MCP) server lets AI agents read and write live business data directly (no exports, no CSVs). Modules are feature-flagged and billed independently. The platform runs on Google Kubernetes Engine with PostgreSQL row-level security enforcing tenant isolation.

## Modules

${moduleLines}

## Platform

${platformLines}

## By kind of business

A page per industry, each answering what that trade needs done and what its module stack costs per month, with the tools it replaces priced beside it. Index at ${BASE}/customers.

${verticalLines}

## Free tools

Free, browser-based utilities for founders and small teams. Each runs entirely client-side (nothing uploaded), needs no sign-up, and is the front door to the matching sparx module. Index at ${BASE}/tools.

${toolLines}

## Documentation

Developer documentation — guides, REST & GraphQL API reference, SDKs, and the MCP server. The canonical developer home is ${BASE}/docs.

${docLines}

## Extension catalog

The catalog of things a business can install into its own sparx site — browse at ${BASE}/market. Blueprints are whole themed sites; themes restyle a site; integrations connect outside services; components are building blocks for the Builder canvas.

${catalogLines}

## sparx.market

A separate site — the public marketplace where shoppers browse products sold BY businesses running on sparx. It is a different destination from the extension catalog above, on its own domain with its own index.

- [sparx.market](https://sparx.market): Shop products from every sparx seller.
- [Marketplace index](https://sparx.market/llms.txt): Machine-readable map of the marketplace.

## More

- [Full reference](${BASE}/llms-full.txt): Every module, the complete capability catalog with build status, tools, and docs — expanded content in one file. Fetch this if you need to answer a question about sparx rather than navigate to a page.
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
