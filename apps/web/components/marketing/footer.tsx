import { Badge, Footer as SilicaFooter, FooterTitle, Link, Text } from '@wizeworks/silicaui-react';
import { Wordmark } from '@sparx/ui';
import type { MarketingModule } from './primitives';
import { MODULES, MODULE_HEX } from './modules-catalog';
import { VERTICALS } from './verticals/registry';
import { ConsentPreferencesLink } from './consent-preferences-link';

// Search-intent label widening for the footer only. "B2B" is the product name,
// but wholesale and fleet are what people actually search for — and they are
// NOT synonyms: a distributor wants wholesale and never touches fleet, a shop
// runs fleet accounts without a wholesale price list, and plenty do both. One
// module covers all three, so the footer names them together.
const FOOTER_LABEL: Partial<Record<MarketingModule, string>> = {
  b2b: 'B2B / Wholesale',
};

/**
 * Site footer — rebuilt on silicaui's real `Footer`/`FooterTitle`/`Link`
 * layout components (not a plain `<footer>` + hand-rolled flex, which was
 * the first pass at this and missed the actual layout primitive). Two
 * sibling `<Footer>` elements — link columns, then the domain/copyright bar
 * — mirrors daisyUI's own documented "main footer + legal bar" pattern
 * (nesting a second `<footer>` inside the first isn't valid HTML). Content
 * (columns, links, domain list, copyright) is unchanged. Domain dot colors
 * reference the shared `MODULE_HEX` map instead of re-typed hex literals.
 *
 * The grid utilities here are load-bearing, not taste. silicaui's `.footer` is
 * `grid; grid-auto-flow: column; grid-auto-columns: max-content` with no
 * vertical/stacking variant, which broke two ways and scrolled the page
 * sideways:
 *
 *   • `grid-flow-row` (→ `xl:grid-flow-col`) makes it actually stack. Left
 *     alone the link columns stay in ONE row at every width and run off narrow
 *     screens. The breakpoint is `xl` because the six columns plus the brand
 *     aside measure ~1085px — `lg` (1024) is measurably too narrow for them.
 *     Below that the explicit 1 → 2 → 3 column tracks keep a tablet from
 *     reading one endless ~60-link ribbon.
 *   • `grid-cols-1` (→ `xl:grid-cols-none`, back to auto) is the one that fixes
 *     the legal bar. The flow direction was never the bar's problem —
 *     `grid-auto-columns: max-content` sizes its implicit column to the
 *     UNWRAPPED domain list (~1330px) no matter which way the grid flows, so
 *     the row's `flex-wrap` had infinite room and never wrapped. An explicit
 *     `minmax(0, 1fr)` track is what bounds it to the viewport.
 *
 * This is layout composition, not a re-skin. Delete it if silicaui ever grows a
 * real responsive footer.
 */
interface FooterLink {
  label: string;
  href: string;
}

const COLUMNS: { title: string; links: FooterLink[] }[] = [
  {
    title: 'Modules',
    links: [
      // Derived from MODULES so the footer can never list a different set than
      // the header megamenu. Modules with no page yet fall back to /pricing.
      // FOOTER_LABEL widens a couple of labels for search intent — someone
      // scanning for "wholesale" should recognise B2B without clicking.
      ...MODULES.map((m) => ({
        label: FOOTER_LABEL[m.id] ?? m.label,
        href: m.href ?? '/pricing',
      })),
    ],
  },
  {
    title: 'Platform',
    links: [
      { label: 'Features', href: '/features' },
      { label: 'Early access', href: '/early' },
      { label: 'Pricing', href: '/pricing' },
      { label: 'Free tools', href: '/tools' },
      { label: 'Themes', href: '/market/themes' },
      // "Blueprints & add-ons", not "Marketplace": /market is the catalog of
      // things you install into your own site, while sparx.market is the separate
      // shopping destination. Labelling this one "Marketplace" made the two read
      // as the same product.
      { label: 'Blueprints & add-ons', href: '/market' },
      { label: 'Managed hosting', href: '/hosting' },
      { label: 'Enterprise', href: '/enterprise' },
      { label: 'Migration tools', href: '/migrate' },
      { label: 'Changelog', href: '/changelog' },
    ],
  },
  {
    // Derived from VERTICALS so the footer can never list an industry page that
    // does not exist, or miss one that does. On every page of the site, this is
    // what turns six ad-landing pages into a crawlable cluster rather than six
    // orphans reachable only from the hub.
    title: 'By industry',
    links: [
      ...VERTICALS.map((v) => ({ label: v.label, href: `/for/${v.slug}` })),
      { label: 'Every kind of business', href: '/customers' },
    ],
  },
  {
    title: 'Developers',
    // Docs are first-class on sparx.works/docs (the canonical developer home) —
    // sparx.software 301s here. Only live routes are linked; the rest of the IA
    // (GraphQL, MCP, SDK, self-host) is visible in the docs sidebar as upcoming.
    links: [
      { label: 'Documentation', href: '/docs' },
      { label: 'Quickstart', href: '/docs/quickstart' },
      { label: 'API reference', href: '/docs/api/orders/create' },
      { label: 'Agentic & MCP', href: '/agentic' },
      { label: 'Changelog', href: '/changelog' },
      { label: 'Open source', href: '/open-source' },
      // Ingredient-brand credit: the design system every sparx surface is built
      // on, for the technical/agency visitor who wants the underlying primitives.
      // It lives in the Developers column, not the funnel — see silicaui.com.
      { label: 'silicaui design system', href: 'https://silicaui.com' },
    ],
  },
  {
    title: 'Partners',
    links: [
      { label: 'Partner program', href: '/partners' },
      { label: 'Partner directory', href: '/partners/directory' },
      { label: 'Business OS Bootcamp', href: '/bootcamp' },
      { label: 'Become a partner', href: '/partners#apply' },
    ],
  },
  {
    title: 'Company',
    links: [
      // /customers is not listed twice — the "By industry" column above ends on
      // it as "Every kind of business", which is where someone looking for it
      // will actually be looking.
      { label: 'About WizeWorks', href: '/about' },
      { label: 'Brand', href: '/brand' },
      { label: 'Press', href: '/press' },
      { label: 'Careers', href: '/careers' },
      { label: 'Contact', href: '/contact' },
    ],
  },
  {
    title: 'Legal & trust',
    links: [
      { label: 'Terms of service', href: '/legal/terms' },
      { label: 'Privacy policy', href: '/legal/privacy' },
      { label: 'Data processing', href: '/legal/dpa' },
      { label: 'Subprocessors', href: '/legal/subprocessors' },
      { label: 'Security', href: '/security' },
      { label: 'Status & SLA', href: 'https://status.sparx.works' },
      { label: 'Acceptable use', href: '/legal/aup' },
    ],
  },
];

const DOMAINS: { name: string; module?: MarketingModule; primary?: boolean }[] = [
  { name: 'sparx.works', module: 'builder', primary: true },
  { name: 'sparx.zone', module: 'builder' },
  { name: 'sparxcms.com', module: 'cms' },
  { name: 'sparxcrm.com', module: 'crm' },
  { name: 'sparxemail.com', module: 'email' },
  { name: 'sparxb2b.com', module: 'b2b' },
  { name: 'sparx.email' },
  { name: 'sparx.host' },
  { name: 'sparx.software' },
  { name: 'sparx.exchange' },
  { name: 'sparx.market' },
];

const LINK_CLASS = 'hover:text-sm';

export function Footer() {
  return (
    <>
      <SilicaFooter className="bg-base-100 border-base-300 grid-flow-row grid-cols-1 gap-x-8 gap-y-10 border-t px-6 pt-16 pb-10 sm:grid-cols-2 sm:px-8 lg:grid-cols-3 xl:grid-flow-col xl:grid-cols-none">
        <aside className="flex w-full max-w-[340px] min-w-60 flex-col gap-5">
          <Wordmark size={48} />
          <Text className="text-sm">
            Modular content and commerce OS by WizeWorks. Built in Visalia, California. Operating
            worldwide.
          </Text>
          {/* `solid`, not `soft`. A soft badge paints its label in the RAW
              accent over a 15% tint of the same accent — measured 3.79:1 here,
              on every page of the site (docs/silicaui/02-core-asks.md §2). The
              dot keeps `bg-success` because a fill is exactly what that hue is
              good for. */}
          <Badge color="success" variant="solid" className="w-fit gap-1.5">
            <span className="bg-success-content h-1.5 w-1.5 rounded-full" />
            All systems operational
          </Badge>
          <Text variant="caption">status.sparx.works</Text>
        </aside>

        {COLUMNS.map((col) => (
          <nav key={col.title}>
            <FooterTitle>{col.title}</FooterTitle>
            {col.links.map((link) => {
              const external = link.href.startsWith('http');
              return (
                <Link
                  key={link.label}
                  href={link.href}
                  {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  className={LINK_CLASS}
                >
                  {link.label}
                  {external ? <span className="ml-1">↗</span> : null}
                </Link>
              );
            })}
            {/* Consent control lives with the legal links, not as floating chrome. */}
            {col.title === 'Legal & trust' && <ConsentPreferencesLink className={LINK_CLASS} />}
          </nav>
        ))}
      </SilicaFooter>

      <SilicaFooter className="bg-base-100 grid-flow-row grid-cols-1 px-6 pb-8 sm:px-8">
        <div className="flex w-full flex-col gap-5">
          <div className="flex flex-col gap-5">
            <FooterTitle>The sparx domain network</FooterTitle>
            <div className="flex flex-wrap gap-6">
              {DOMAINS.map((d) => {
                const color = d.module ? MODULE_HEX[d.module] : undefined;
                return (
                  <span key={d.name} className="flex items-center gap-2">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${color ? '' : 'bg-base-content/40'}`}
                      style={color ? { backgroundColor: color } : undefined}
                    />
                    <Text
                      variant="caption"
                      className={d.primary ? 'text-base-content' : 'text-base-content'}
                    >
                      {d.name}
                    </Text>
                  </span>
                );
              })}
            </div>
          </div>

          <div className="border-base-300 flex flex-wrap items-center justify-between gap-3 border-t pt-6">
            <Text variant="caption">
              © 2026 WizeWorks LLC · Visalia, California · sparx is a registered trademark of
              WizeWorks.
            </Text>
            <div className="flex items-center gap-4">
              <Text variant="caption">v1.0 · 2026-05-27</Text>
              <Text variant="caption" className="text-base-content">
                EN · USD
              </Text>
            </div>
          </div>
        </div>
      </SilicaFooter>
    </>
  );
}
