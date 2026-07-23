// Storefront root layout. Resolves the tenant from the Host, injects the
// tenant's theme tokens (light + dark), frames every page in header/footer
// chrome, and mounts the client providers.
//
// When the tenant has a published Site Builder snapshot, its compiled tokens
// (a superset of the CommerceSiteTheme columns — adds foreground/border/container)
// and its data-driven header/footer/announcement blocks take over. Without a
// snapshot the legacy themeToCss(CommerceSiteTheme) path and collection-derived
// chrome still render, so brand-new stores look polished out of the box.
//
// Unknown hosts (no tenant) render a bare frame — the page-level not-found
// handles the "store not found" messaging.

import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';

import type { HeaderConfig, FooterConfig, AnnouncementConfig } from '@sparx/sitebuilder-schemas';

import { CartProvider } from '@/components/cart-provider';
import { CustomerProvider } from '@/components/customer-provider';
import { WishlistProvider } from '@/components/wishlist-provider';
import { MiniCart } from '@/components/mini-cart';
import { ModeToggle } from '@/components/mode-toggle';
import { PreviewBridge } from '@/components/preview-bridge';
import { RevealController } from '@/components/reveal-controller';
import { MotionController } from '@/components/motion-controller';
import { SiteHeader, type NavItem } from '@/components/site-header';
import { SiteFooter, type FooterColumn } from '@/components/site-footer';
import { SiteSuspended } from '@/components/site-suspended';
import { BuilderSiteChrome } from '@/components/builder-renderer';
import { SilicaChrome } from '@/components/silica-chrome';
import { storefrontHostRenderer } from '@/components/silica-host-cores';
import { SilicaBehaviors } from '@/components/silica-behaviors';
import { StorefrontBuilderRuntime } from '@/components/storefront-builder-runtime';
import type { PublishedSilicaFrameDto } from '@sparx/builder-schemas';
import { getPublishedSilicaFrame } from '@/lib/silica';
import { buildSilicaHost } from '@/lib/silica-data';
import {
  buildSilicaThemeCss,
  buildSilicaThemeCssFromTheme,
  brandFontHref,
  themeFontFamilies,
} from '@sparx/site-themes';
import { listCollections } from '@/lib/commerce';
import { getLegalFooterLinks } from '@/lib/legal';
import { getPublishedBuilderLayout, getPublishedBuilderStyles } from '@/lib/builder';
import { loadSiteData } from '@/lib/builder-data';
import { ConsentManager } from '@/components/consent/consent-manager';
import { SiteAnalyticsBeacon } from '@/components/site-analytics-beacon';
import { TopProgressBar } from '@/components/top-progress-bar';
import { ChatWidget } from '@sparx/chat-widget';
import { ChunkReloadGuard, MadeWithSparx } from '@sparx/ui';
import { mediaUrl } from '@/lib/media';
import { ogImageUrl } from '@/lib/og';
import { resolveActivePropertySlug, resolveSite, type SiteTheme } from '@/lib/site-context';
import { buildCommerceSiteThemeCss } from '@/lib/theme';
import {
  getPublishedSite,
  getNavigationMenu,
  type NavNode,
  type PublishedSnapshot,
} from '@/lib/site';

// MUST be first: declares the cascade-layer order so `st-legacy` (the legacy
// site.css defaults) ranks BENEATH site-ui's `components` layer. Without this,
// unlayered/late-registered legacy rules shadow site-ui and silently break every
// themeable control. See layers.css.
import './layers.css';
import './globals.css';
import './site.css';
// The custom-section template primitives (st-tpl-*), shared with the dashboard
// Section Studio preview so both render identically (docs/38 Phase C).
import '@sparx/section-template-react/section-template.css';
// The Surface component library (docs/46/47): the tenant-themed `st-*` component
// + recipe classes that authored `node.class` strings resolve against. It owns
// the `st-*` component vocabulary via `@layer components`, which outranks
// `@layer st-legacy` (see layers.css). Plain compiled CSS — no preflight.
import '@sparx/site-ui/styles.css';

const FOOTER_YEAR = 2026; // static so SSR output stays deterministic/cacheable
const THEME_COOKIE = 'sparx_theme';

export async function generateMetadata(): Promise<Metadata> {
  const site = await resolveSite();
  if (!site) {
    return {
      title: 'Store not found',
      robots: { index: false, follow: false },
      icons: { icon: '/sparx-icon.svg' },
    };
  }
  // A suspended site (docs/17 §6) serves the overlay, not its content — so it must
  // NOT be indexed while dark (and its title must not leak the tenant/billing state).
  if (site.billingPhase === 'suspended') {
    return {
      title: 'Temporarily unavailable',
      robots: { index: false, follow: false },
      icons: { icon: '/sparx-icon.svg' },
    };
  }
  const favicon = mediaUrl(site.theme?.faviconMediaId ?? null, site.slug);

  // metadataBase makes every page's relative OG image (the `/api/og` fallback
  // card, docs/50 §5) resolve to an absolute URL on THIS tenant's origin, so the
  // social crawler fetches it from the right host. Built from the forwarded host.
  const mdHdrs = await headers();
  const host = mdHdrs.get('x-forwarded-host') ?? mdHdrs.get('host');
  const proto = mdHdrs.get('x-forwarded-proto') ?? 'https';
  const origin = host ? `${proto}://${host}` : undefined;

  return {
    ...(origin ? { metadataBase: new URL(origin) } : {}),
    title: { default: site.name, template: `%s · ${site.name}` },
    description: `Shop ${site.name}.`,
    // Site-level default social card. Pages with a real image (product photo,
    // collection hero, author-set OG) override this with their own; pages without
    // one inherit a tenant-branded generated card.
    openGraph: {
      type: 'website',
      title: site.name,
      description: `Shop ${site.name}.`,
      images: [
        ogImageUrl({
          title: site.name,
          eyebrow: 'Site',
          brand: site.name,
          accent: site.theme?.colorPrimary,
        }),
      ],
    },
    robots: { index: true, follow: true },
    // The tenant's own favicon always wins. Until they set one, fall back to
    // the sparx mark (public/) rather than the browser's default globe — a
    // brand-new store still looks finished. Deliberately favicon-only: no
    // apple-icon / manifest, so sparx never brands a tenant's home-screen
    // install. Assets: apps/site/public/{favicon.ico,sparx-icon.svg}.
    icons: favicon
      ? { icon: favicon }
      : {
          icon: [
            { url: '/sparx-icon.svg', type: 'image/svg+xml' },
            { url: '/favicon.ico', sizes: 'any' },
          ],
        },
  };
}

// ── Theme CSS ──────────────────────────────────────────────────────────────
//
// Compiled by the Token Model v2 engine (docs/33-token-model-v2.md). The theme
// key comes from the published snapshot when present, else the tenant's preset;
// brand identity + presentation surfaces are sourced from the data the layout
// already fetched. buildCommerceSiteThemeCss emits the canonical `--st-*` tokens
// plus the legacy aliases the current site.css still reads.

function buildThemeCss(
  snapshot: PublishedSnapshot | null,
  theme: SiteTheme | null,
  preset: string | null | undefined
): string {
  const themeKey = snapshot?.themeKey ?? preset ?? 'apex';
  return buildCommerceSiteThemeCss({
    themeKey,
    tenantTheme: theme,
    snapshotTokens: snapshot?.compiledTokens ?? null,
    compiledV2: snapshot?.compiledV2 ?? null,
  });
}

// Brand web fonts — the tenant's chosen families (e.g. 'Quicksand', 'Nunito')
// must be LOADED or the browser silently falls back to Geist. `brandFontHref`
// (@sparx/site-themes, shared with the Builder canvas so the two never drift)
// builds one Google Fonts stylesheet for whatever the tenant chose; see its use
// below with the compiled snapshot as the source of truth + theme columns as a
// backstop.

// Inline, before-paint script that resolves data-theme for policies that can't
// be decided at SSR time (auto = prefers-color-scheme, toggle = cookie). Fixed
// policies (light-only / dark-only) are set on <html> server-side and need no
// script. Kept tiny and self-contained so it runs before first paint.
function noFlashScript(policy: 'auto' | 'toggle'): string {
  return `(function(){try{var d=document.documentElement;var p=${JSON.stringify(policy)};var dark=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches;if(p==='toggle'){var m=document.cookie.match(/(?:^|;\\s*)sparx_theme=(light|dark)/);d.setAttribute('data-theme',m?m[1]:(dark?'dark':'light'));}else{d.setAttribute('data-theme',dark?'dark':'light');}}catch(e){}})();`;
}

// Before-paint flag that enables scroll-reveal entrances. Gating the hidden
// initial state on these classes means content is fully visible when JS is off
// (this script never runs) or reduced motion is requested (the classes are not
// added), avoiding any flash of invisible content. `st-reveal-ready` gates the
// legacy section path; `st-anim-ready` gates the docs/61 Builder motion
// (`.st-reveal` + SCROLL_MOTION_CSS, driven by MotionController).
const REVEAL_INIT_SCRIPT = `(function(){try{if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;document.documentElement.classList.add('st-reveal-ready','st-anim-ready');}catch(e){}})();`;

// Before-paint: reflect the recorded cookie-consent decision onto <html> as a
// `data-consent` attribute (space-separated granted categories) so any deferred
// tracker can self-check before initializing (docs/42 §4.4). Only injected when
// the tenant runs a consent mode.
const CONSENT_INIT_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|;\\s*)sparx_consent_state=([^;]+)/);if(!m)return;var s=JSON.parse(decodeURIComponent(m[1]));var g=['strictly_necessary'];['preferences','analytics','marketing'].forEach(function(c){if(s[c])g.push(c)});document.documentElement.setAttribute('data-consent',g.join(' '));}catch(e){}})();`;

// ── Header / footer chrome from the snapshot's layout blocks ─────────────────

function navNodesToItems(nodes: NavNode[]): NavItem[] {
  return nodes.map((n) => ({ label: n.label, href: n.href }));
}

const isExternal = (href: string) => /^https?:\/\//i.test(href);

/** Empty/whitespace config strings → null so callers fall back to defaults. */
function blankToNull(value: string | undefined): string | null {
  return value && value.length > 0 ? value : null;
}

// Map a nav menu into footer columns: a top-level item WITH children becomes a
// titled column; loose top-level leaves collect under a single "Links" column.
function navNodesToFooterColumns(nodes: NavNode[]): FooterColumn[] {
  const columns: FooterColumn[] = [];
  const loose: FooterColumn['links'] = [];
  for (const node of nodes) {
    if (node.children.length > 0) {
      columns.push({
        title: node.label,
        links: node.children.map((c) => ({
          label: c.label,
          href: c.href,
          external: isExternal(c.href),
        })),
      });
    } else {
      loose.push({ label: node.label, href: node.href, external: isExternal(node.href) });
    }
  }
  if (loose.length > 0) columns.unshift({ title: 'Links', links: loose });
  return columns;
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Three independent resolutions, awaited together (docs/127 §9). `resolveSite` and
  // `resolveActivePropertySlug` share a request-cached `resolveSiteRoute()` underneath,
  // so overlapping them costs one round-trip, not two.
  const [site, activePropertySlug, hdrs] = await Promise.all([
    resolveSite(),
    resolveActivePropertySlug(),
    headers(),
  ]);

  // Billing suspended (docs/17 §6): serve the "site unavailable" overlay as the
  // WHOLE document and short-circuit ALL storefront chrome + data reads below. A
  // lapsed tenant is rare, so paying the one tenant fetch (already done above) and
  // nothing else is the cheap, correct path. Reactivating flips billingPhase back
  // and the site returns unchanged. Grace/trialing/active all render normally.
  if (site?.billingPhase === 'suspended') {
    return <SiteSuspended />;
  }
  // Live Chat (docs/56, docs/69 A-4) — the floating widget mounts only when the
  // tenant has the `chat` module active. The widget is a client component, so it
  // talks to the browser-reachable public API origin (NEXT_PUBLIC_API_URL), not
  // the in-cluster SPARX_API_REST_URL the SSR data fetchers use.
  const chatEnabled = Boolean(
    (site?.settings as { modules?: { chat?: { enabled?: boolean } } } | undefined)?.modules?.chat
      ?.enabled
  );
  const chatApiUrl = process.env.NEXT_PUBLIC_API_URL ?? '';
  // Mirror of the `?sparxSitePreview=` token, set by the proxy so this layout
  // (which the App Router never hands searchParams) can render the DRAFT chrome
  // — header/footer/announcement — in the editor preview, not just published.
  const sitePreviewToken = hdrs.get('x-sparx-site-preview') ?? undefined;

  // Four INDEPENDENT reads, awaited together (docs/127 §9). They were sequential, so
  // chrome sat four api-rest round-trips deep before it could render — on a path that
  // is `no-store`, meaning every request paid all four. None of them feeds another:
  //
  //   · snapshot      — the legacy Site Builder publish snapshot, read here for THEME
  //   · builderLayout — the sparx Builder chrome shell (docs/45), WINS over legacy
  //                     header/footer when present ("Builder owns it, else fall
  //                     through", cf. docs/44 §2.5)
  //   · silicaFrame   — the silica engine's published FRAME (docs/118 Stage 6), which
  //                     wins over BOTH of the above by the same additive rule. Null
  //                     until a silica layout is published, so a non-silica tenant is
  //                     byte-for-byte unchanged
  //   · surfaceCss    — the compiled Surface stylesheet (docs/47 §5): the utilities
  //                     authored as node `class` strings across the published trees.
  //                     '' until class-first authoring is in use
  const [snapshot, builderLayout, silicaFrame, surfaceCss] = await Promise.all([
    site ? getPublishedSite(site.slug, sitePreviewToken, activePropertySlug ?? undefined) : null,
    site ? getPublishedBuilderLayout(site.slug) : null,
    site
      ? getPublishedSilicaFrame(site.slug)
      : Promise.resolve<PublishedSilicaFrameDto>({ frame: null, symbols: {}, theme: null }),
    site ? getPublishedBuilderStyles(site.slug) : '',
  ]);

  const silicaActive = Boolean(silicaFrame.frame);
  // Depends on silicaFrame, so it stays sequential behind it.
  const silicaHost =
    site && silicaFrame.frame
      ? await buildSilicaHost(site.slug, silicaFrame.frame.root, {
          currency: site.commerce.defaultCurrency,
          locale: site.commerce.defaultLocale,
          // The frame binds site.* (brand name, logo, tagline, socials) — supply it
          // so the navbar/footer render the tenant's identity, not a placeholder.
          // Every field Site settings COLLECTS must be supplied here: a declared
          // binding the host never fills resolves empty, and an empty value blanks
          // the node it is bound to.
          site: {
            name: site.name,
            tagline: site.tagline,
            logoUrl: mediaUrl(site.theme?.logoMediaId ?? null, site.slug),
            logoDarkUrl: mediaUrl(site.theme?.logoDarkMediaId ?? null, site.slug),
            socials: site.socials,
          },
        })
      : null;

  // Active base theme preset (additive registry) for the no-snapshot path.
  const themePreset = (site?.settings as { theme?: { preset?: string } } | undefined)?.theme
    ?.preset;
  const themeCss = buildThemeCss(snapshot, site?.theme ?? null, themePreset);

  // The per-tenant silica theme file (docs/118 §1.0 north star): silicaui's own
  // token vocabulary (`--color-primary`, `--radius-box`, …) so every generated
  // silica class resolves with no per-tenant CSS compile. Emitted only when the
  // silica frame is live. Two sources, one output:
  //   · an AUTHORED theme (the builder round-trips `Site.theme` through publish)
  //     projects straight to CSS — what the author previewed IS what ships.
  //   · otherwise the tenant's BRAND-DERIVED compiled theme, so a tenant who never
  //     touched the theme still renders in its brand.
  // Both emit identical selectors, so switching between them is invisible. Coexists
  // with `themeCss` during the parallel run; `--st-*` retires at the flip.
  const silicaThemeCss = !silicaActive
    ? ''
    : silicaFrame.theme
      ? buildSilicaThemeCssFromTheme(silicaFrame.theme)
      : snapshot?.compiledV2
        ? buildSilicaThemeCss(snapshot.compiledV2)
        : '';

  // The fonts to load, or the storefront renders every theme in the Geist fallback.
  // The AUTHORED silica theme leads: a typeface/heading font picked in the builder's
  // Design inspector lives ONLY in that theme (`--font-head` + `theme.fonts`), not the
  // brand columns — so reading just the columns names the font but never loads it.
  // Compiled snapshot + brand columns follow as the backstop for a brand-derived
  // theme; `brandFontHref` de-dupes the overlap.
  const fontHref = brandFontHref([
    ...(silicaActive && silicaFrame.theme ? themeFontFamilies(silicaFrame.theme) : []),
    snapshot?.compiledV2?.shared.fontHeading,
    snapshot?.compiledV2?.shared.fontBody,
    site?.theme?.fontHeading,
    site?.theme?.fontBody,
  ]);

  // Appearance policy → initial data-theme + whether the no-flash script runs.
  const policy = snapshot?.appearancePolicy ?? 'light-only';
  let initialTheme: 'light' | 'dark' = 'light';
  if (policy === 'dark-only') {
    initialTheme = 'dark';
  } else if (policy === 'toggle') {
    const cookieTheme = (await cookies()).get(THEME_COOKIE)?.value;
    initialTheme = cookieTheme === 'dark' ? 'dark' : 'light';
  }
  const dynamicPolicy = policy === 'auto' || policy === 'toggle' ? policy : null;

  // Site-layout render data — built after the appearance policy resolves so the
  // Builder `ThemeToggle` node can auto-hide unless both themes are offered.
  const siteData =
    site && builderLayout ? loadSiteData(site, { policy, initial: initialTheme }) : null;

  // Resolve header/footer/announcement from the snapshot's layout blocks.
  const blocks: PublishedSnapshot['layout'] = snapshot?.layout ?? [];
  const headerBlock = blocks.find((b) => b.slot === 'header' && b.visible);
  const footerBlock = blocks.find((b) => b.slot === 'footer' && b.visible);
  const announceBlock = blocks.find((b) => b.slot === 'announcement' && b.visible);

  const headerConfig = (headerBlock?.config ?? {}) as Partial<HeaderConfig>;
  const footerConfig = (footerBlock?.config ?? {}) as Partial<FooterConfig>;
  const announceConfig = (announceBlock?.config ?? {}) as Partial<AnnouncementConfig>;

  // Default chrome (no snapshot, or snapshot block without a menu): derive nav
  // from the tenant's collections so a brand-new store still has working links.
  // Skipped entirely when a Builder layout owns the chrome.
  let collectionNav: NavItem[] = [];
  if (site && !builderLayout) {
    try {
      const collections = await listCollections(site.slug);
      collectionNav = collections.slice(0, 4).map((c) => ({
        label: c.name,
        href: `/collections/${c.handle}`,
      }));
    } catch {
      collectionNav = [];
    }
  }

  let nav: NavItem[] = [
    { label: 'Shop all', href: '/products' },
    ...collectionNav,
    { label: 'Collections', href: '/collections' },
  ];

  let footerColumns: FooterColumn[] = [
    {
      title: 'Shop',
      links: [
        { label: 'All products', href: '/products' },
        { label: 'Collections', href: '/collections' },
        { label: 'Search', href: '/search' },
      ],
    },
    {
      title: 'Account',
      links: [
        { label: 'Sign in', href: '/account' },
        { label: 'Orders', href: '/account/orders' },
        { label: 'Cart', href: '/cart' },
      ],
    },
    {
      title: 'Info',
      links: [{ label: 'Contact', href: '/contact' }],
    },
  ];

  // Snapshot nav menus override the defaults when present + non-empty.
  if (site && !builderLayout && headerBlock?.navigationMenuId) {
    const items = await getNavigationMenu(site.slug, headerBlock.navigationMenuId);
    if (items.length > 0) nav = navNodesToItems(items);
  }
  if (site && !builderLayout && footerBlock?.navigationMenuId) {
    const items = await getNavigationMenu(site.slug, footerBlock.navigationMenuId);
    const cols = navNodesToFooterColumns(items);
    if (cols.length > 0) footerColumns = cols;
  }

  // Legal pages (privacy/terms/cookie-policy/…) resolve from doc placements
  // (docs/42) and append as a "Legal" column — independent of whether the
  // footer above is default or nav-menu-driven, since legal links are
  // compliance-driven, not editorial. Omitted entirely when nothing is
  // published yet.
  if (site && !builderLayout) {
    const legalLinks = await getLegalFooterLinks(site.slug, activePropertySlug ?? undefined);
    if (legalLinks.length > 0) {
      footerColumns = [
        ...footerColumns,
        { title: 'Legal', links: legalLinks.map((l) => ({ label: l.label, href: l.href })) },
      ];
    }
  }

  const announcement =
    announceBlock && announceConfig.enabled && announceConfig.text ? announceConfig.text : null;
  const socialLinks = footerConfig.socialLinks ?? [];

  // Site-wide structured data (docs/50): Organization identity (logo + social
  // `sameAs`) and a WebSite with the storefront search action — so search and
  // answer engines attribute pages to this store and can surface a sitelinks
  // search box. Needs the public origin (forwarded host) for absolute URLs.
  const sdHost = hdrs.get('x-forwarded-host') ?? hdrs.get('host');
  const sdProto = hdrs.get('x-forwarded-proto') ?? 'https';
  const origin = sdHost ? `${sdProto}://${sdHost}` : null;
  const logo = site ? mediaUrl(site.theme?.logoMediaId ?? null, site.slug) : null;
  const sameAs = site ? Object.values(site.socials).filter(Boolean) : [];
  const orgJsonLd =
    site && origin
      ? {
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: site.name,
          url: origin,
          ...(logo ? { logo } : {}),
          ...(sameAs.length > 0 ? { sameAs } : {}),
        }
      : null;
  const siteJsonLd =
    site && origin
      ? {
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: site.name,
          url: origin,
          potentialAction: {
            '@type': 'SearchAction',
            target: {
              '@type': 'EntryPoint',
              urlTemplate: `${origin}/search?q={search_term_string}`,
            },
            'query-input': 'required name=search_term_string',
          },
        }
      : null;

  return (
    <html
      lang="en"
      data-theme={initialTheme}
      suppressHydrationWarning
      className={`${GeistSans.variable} ${GeistMono.variable}`}
    >
      <head>
        {fontHref ? (
          <>
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
            <link rel="stylesheet" href={fontHref} />
          </>
        ) : null}
        {themeCss ? <style dangerouslySetInnerHTML={{ __html: themeCss }} /> : null}
        {silicaThemeCss ? (
          <style data-silica-theme dangerouslySetInnerHTML={{ __html: silicaThemeCss }} />
        ) : null}
        {surfaceCss ? (
          <style data-surface-tenant dangerouslySetInnerHTML={{ __html: surfaceCss }} />
        ) : null}
        {dynamicPolicy ? (
          <script dangerouslySetInnerHTML={{ __html: noFlashScript(dynamicPolicy) }} />
        ) : null}
        <script dangerouslySetInnerHTML={{ __html: REVEAL_INIT_SCRIPT }} />
        {site && site.consent.mode !== 'off' ? (
          <script dangerouslySetInnerHTML={{ __html: CONSENT_INIT_SCRIPT }} />
        ) : null}
        {orgJsonLd ? (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
          />
        ) : null}
        {siteJsonLd ? (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd) }}
          />
        ) : null}
      </head>
      <body className="st-body">
        {/* Page-top loading bar in the tenant's own brand (--st-primary). */}
        <TopProgressBar />
        {/* Silently recover a shopper's tab whose chunks were purged by a deploy.
            Deliberately no visible "refresh" toast on customer-facing pages. */}
        <ChunkReloadGuard />
        <PreviewBridge />
        <RevealController />
        <MotionController />
        {site ? (
          <CustomerProvider tenantSlug={site.slug} propertySlug={activePropertySlug ?? undefined}>
            <WishlistProvider>
              <CartProvider
                tenantSlug={site.slug}
                propertySlug={activePropertySlug ?? undefined}
                currency={site.commerce.defaultCurrency}
              >
                <StorefrontBuilderRuntime>
                  <div className="st-frame">
                    {silicaActive && silicaFrame.frame ? (
                      // The silica engine's published frame owns the chrome (docs/118
                      // Stage 6): the routed page drops at the frame's own Outlet.
                      // The frame carries its own <main> landmark (id="st-main"), so
                      // children pass in directly — no second <main> wrapper.
                      <SilicaChrome
                        frame={silicaFrame.frame.root}
                        symbols={silicaFrame.symbols}
                        host={silicaHost ?? undefined}
                        // The chrome's host cores (the brand mark) render live from the
                        // resolved site, so Site settings reach the header with no
                        // re-publish.
                        renderHost={storefrontHostRenderer({
                          site,
                          ...(activePropertySlug ? { propertySlug: activePropertySlug } : {}),
                        })}
                      >
                        {children}
                      </SilicaChrome>
                    ) : builderLayout && siteData ? (
                      // A published Builder layout owns the chrome: render its tree
                      // with the page dropped at the Outlet (docs/45 §2.6).
                      <BuilderSiteChrome tree={builderLayout.tree} data={siteData}>
                        <main className="st-main" id="st-main" tabIndex={-1}>
                          {children}
                        </main>
                      </BuilderSiteChrome>
                    ) : (
                      <>
                        <SiteHeader
                          site={site}
                          nav={nav}
                          announcement={announcement}
                          announcementHref={blankToNull(announceConfig.linkUrl)}
                          showSearch={headerConfig.showSearch ?? true}
                          logoPlacement={headerConfig.logoPlacement ?? 'left'}
                          overlay={headerConfig.overlay ?? false}
                          modeToggle={
                            policy === 'toggle' ? <ModeToggle initial={initialTheme} /> : undefined
                          }
                        />
                        <main className="st-main" id="st-main" tabIndex={-1}>
                          {children}
                        </main>
                        <SiteFooter
                          site={site}
                          columns={footerColumns}
                          year={FOOTER_YEAR}
                          copyright={blankToNull(footerConfig.copyright)}
                          socialLinks={socialLinks.map((s) => ({
                            platform: s.platform,
                            url: s.url,
                          }))}
                          variant={footerConfig.variant ?? 'columns'}
                          tagline={blankToNull(footerConfig.tagline)}
                        />
                      </>
                    )}
                  </div>
                  <MiniCart />
                  {/* The silica behavior runtime (docs/118 Stage 6b): hydrates the
                      data-sui-* markers a published silica page/frame renders, and
                      routes host actions (newsletter, cart) to the providers above.
                      Inert (no-op) on pages with no silica markers, so it's safe
                      during the parallel run. */}
                  <SilicaBehaviors
                    tenantSlug={site.slug}
                    propertySlug={activePropertySlug ?? undefined}
                  />
                  {/* Platform attribution — un-deletable shell chrome (NOT a
                      BuilderNode), fixed in the bottom corner so it reads as part of
                      the site chrome, not a section inserted below the footer. Flips
                      to the bottom-LEFT corner when the chat launcher (fixed
                      bottom-right) is on, so the two don't overlap. Hidden only when
                      the site opts out. */}
                  {site.showSparxCredit !== false ? (
                    <MadeWithSparx placement={chatEnabled && chatApiUrl ? 'left' : 'right'} />
                  ) : null}
                  <ConsentManager tenant={site.slug} config={site.consent} />
                  {chatApiUrl ? (
                    <SiteAnalyticsBeacon
                      apiUrl={chatApiUrl}
                      tenantSlug={site.slug}
                      propertySlug={activePropertySlug ?? undefined}
                    />
                  ) : null}
                  {chatEnabled && chatApiUrl ? (
                    <ChatWidget
                      apiUrl={chatApiUrl}
                      tenantSlug={site.slug}
                      accentColor={site.theme?.colorPrimary ?? null}
                    />
                  ) : null}
                </StorefrontBuilderRuntime>
              </CartProvider>
            </WishlistProvider>
          </CustomerProvider>
        ) : (
          <div className="st-frame">
            <main className="st-main">{children}</main>
          </div>
        )}
      </body>
    </html>
  );
}
