// llms-full.txt — the AI-readable FULL-CONTENT companion to llms.txt (docs/50 §5).
//
// The llmstxt.org convention pairs two files. `/llms.txt` is a link-first MAP:
// short, curated, meant to be read whole so an agent knows where to go. This
// file is the opposite — the expanded CONTENT, so an answer engine can ground a
// response without fetching and parsing a dozen marketing pages. An agent that
// can only afford one request should get a real answer from this one.
//
// Everything here is derived from the same registries the pages render from —
// MODULES (module marketing), CAPABILITY_AREAS (the /features catalog, itself
// the marketing projection of docs/89-feature-catalog.md), TOOLS, DOC_NAV, and
// the extension-catalog registry. Nothing is restated by hand, so this file
// cannot drift from what actually ships. That is the whole design constraint:
// a hand-maintained full-content dump goes stale within a release or two, which
// is exactly the failure llms.txt's PLATFORM_LINKS array demonstrated.
//
// Capability STATUS is carried through verbatim (live / building / planned)
// rather than flattened to a feature list. An answer engine that cannot tell
// shipped from roadmap will confidently describe unbuilt features as available,
// and we would rather it say "planned" than invent availability.

import { MODULES, MODULE_ORDER } from '@/lib/modules';
import { CAPABILITY_AREAS, STATUS_META, capabilityCounts } from '@/lib/capabilities';
import { DOC_NAV } from '@/lib/docs';
import { TOOLS } from '@/components/marketing/tools/registry';
import { LIVE_CATEGORIES } from '@/lib/marketplace-registry';

export const dynamic = 'force-static';

const BASE = 'https://sparx.works';

/** Module sections: lede, every numbered feature, and the real price. */
function moduleSections(): string {
  return MODULE_ORDER.map((key) => {
    const m = MODULES[key];
    const features = m.features
      .map((f) => `**${f.title}** ${f.body}`)
      .map((line) => `- ${line}`)
      .join('\n');
    const price = `${m.pricing.modifier === '+' ? '+' : ''}${m.pricing.price}${m.pricing.period}`;

    return `### sparx ${m.label} — ${price}

${m.lede}

${features}

${m.pricing.bundleNote}${m.marketingDomain ? `\n\nDedicated site: ${m.marketingDomain}` : ''}

Page: ${BASE}/${m.slug}`;
  }).join('\n\n');
}

/** The capability catalog, status-tagged. This is the densest factual section —
 *  it is what an engine should cite when asked "can sparx do X?". */
function capabilitySections(): string {
  return CAPABILITY_AREAS.map((area) => {
    const byStatus = (['live', 'building', 'planned'] as const)
      .map((status) => {
        const names = area.capabilities.filter((c) => c.status === status).map((c) => c.name);
        if (names.length === 0) return null;
        return `- ${STATUS_META[status].label}: ${names.join(', ')}.`;
      })
      .filter(Boolean)
      .join('\n');

    return `### ${area.name}${area.module ? '' : ' (platform-wide)'}

${area.summary}

${byStatus}`;
  }).join('\n\n');
}

function toolSections(): string {
  return TOOLS.map(
    (t) =>
      `- [${t.name}](${BASE}/tools/${t.slug}) — ${t.description} Common searches: ${t.keywords.join(', ')}.`
  ).join('\n');
}

function docSections(): string {
  return DOC_NAV.map((group) => {
    const links = group.links
      .map((l) =>
        l.soon ? `- ${l.title} (planned — no page yet)` : `- [${l.title}](${BASE}${l.href})`
      )
      .join('\n');
    return `**${group.title}**\n\n${links}`;
  }).join('\n\n');
}

export function GET(): Response {
  const counts = capabilityCounts();

  const body = `# sparx — full platform reference

> sparx (by WizeWorks) is a modular content and commerce operating system: site building, commerce, CRM, CMS, email, B2B/wholesale, dropship, scheduling, and a first-class AI/MCP integration in one platform. Businesses activate only the modules they need and are billed per module — a CMS-only publisher, a CRM-only team, and a B2B distributor are all equally first-class.

This is the expanded-content companion to ${BASE}/llms.txt. It contains the full module descriptions, the complete capability catalog with build status, the free-tool index, and the documentation map — enough to answer most questions about sparx without fetching another page.

## What sparx is

sparx is content AND/OR commerce. Selling is one capability, never the assumption: a business can run a content site with no store, a store with no content, or both. Modules are independently activatable and independently billed, with no tiers and no required base plan — you are never charged for a module you have not switched on.

The platform is API-first: every feature exists as an API endpoint, and the dashboard is one consumer among many. A native Model Context Protocol (MCP) server lets AI agents read and write live business data directly — no exports, no CSVs, no scraping. Businesses can also run entirely headless, using the API and MCP without the hosted site module at all.

sparx runs on Google Kubernetes Engine with PostgreSQL row-level security enforcing tenant isolation at the database tier, not just in application code.

**Pricing model.** Flat per-module monthly pricing, no tiers. Each module below lists its own price; the total is the sum of what is switched on, billed as one invoice.

**AI approach.** sparx does not run its own AI on a platform credential. Every AI feature is either bring-your-own-key (the business supplies its own provider key, stored encrypted) or MCP (the business brings its own AI client to its own sparx data). This means AI usage is not marked up and not metered by sparx.

## Modules

${moduleSections()}

## Complete capability catalog

The marketing site headlines the modules above; the platform ships ${counts.live} capabilities live today, with ${counts.building} in build and ${counts.planned} on the roadmap. Status is stated per capability below — "live" means shipped and usable now, "in build" means actively being built, "on the roadmap" means committed but not started. Full page: ${BASE}/features

${capabilitySections()}

## Extension catalog

Businesses extend their own site from the catalog at ${BASE}/market — installable blueprints, themes, integrations, and components. (This is distinct from sparx.market, a separate site where shoppers buy products FROM businesses running on sparx.)

${LIVE_CATEGORIES.map((c) => `- [${c.label}](${BASE}/market/${c.id}): ${c.tagline}`).join('\n')}

## Free tools

Free, browser-based utilities for founders and small teams. Each runs entirely client-side (nothing is uploaded), requires no sign-up, and is the front door to the matching sparx module. Index: ${BASE}/tools

${toolSections()}

## Documentation

Developer documentation — guides, REST & GraphQL API reference, SDKs, and the MCP server. Canonical home: ${BASE}/docs

${docSections()}

## Related sites

- [sparx.market](https://sparx.market): The public marketplace where shoppers buy products from businesses running on sparx. Its own site, its own index at https://sparx.market/llms.txt.
- [WizeWorks](https://wize.works): The company that builds and operates sparx.

## Reference

- [Pricing](${BASE}/pricing): Per-module pricing in full.
- [Security](${BASE}/security): Tenant isolation, data ownership, backups, SLAs.
- [Brand](${BASE}/brand): Brand and design language, with press-ready downloads.
- [Terms](${BASE}/legal/terms) · [Privacy](${BASE}/legal/privacy)
- [Sitemap](${BASE}/sitemap.xml): Full machine-readable URL index.
`;

  return new Response(body, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
    },
  });
}
