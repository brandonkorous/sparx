// Storefront root layout. Resolves the tenant from the Host, injects the tenant's theme
// tokens (light + dark), frames every page in the silica FRAME, and mounts the client
// providers.
//
// ONE chrome tier, not three. The frame is the tenant's published silica layout, or the
// code-authored starter frame until they publish one — so a brand-new site is live
// rather than blank, and the header/footer are real editable nodes either way. The two
// tiers that used to sit beneath it (a sparx-Builder chrome shell, and a hand-built
// SiteHeader/SiteFooter pair driven by the snapshot's layout blocks) were unreachable
// and are gone; see the chrome branch below.
//
// The published Site Builder snapshot is still read, but ONLY for the appearance policy
// and the compiled theme tokens — not for chrome.
//
// Unknown hosts (no tenant) render a bare frame — the page-level not-found handles the
// "store not found" messaging.

import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';

import { CartProvider } from '@/components/cart-provider';
import { CustomerProvider } from '@/components/customer-provider';
import { WishlistProvider } from '@/components/wishlist-provider';
import { MiniCart } from '@/components/mini-cart';
import { PreviewBridge } from '@/components/preview-bridge';
import { RevealController } from '@/components/reveal-controller';
import { MotionController } from '@/components/motion-controller';
import { SiteSuspended } from '@/components/site-suspended';
import { SilicaChrome } from '@/components/silica-chrome';
import { storefrontHostRenderer } from '@/components/silica-host-cores';
import { SilicaBehaviors } from '@/components/silica-behaviors';
import { StorefrontBuilderRuntime } from '@/components/storefront-builder-runtime';
import type { PublishedSilicaFrameDto } from '@sparx/builder-schemas';
import { getPublishedSilicaFrame } from '@/lib/silica';
import { buildSilicaHost } from '@/lib/silica-data';
import { buildSilicaThemeCssFromTheme, brandFontHref, themeFontFamilies } from '@sparx/site-themes';
import { BASE_SILICA_THEME } from '@sparx/silica-catalog';
import { getLegalFooterLinks, type LegalLink } from '@/lib/legal';
import { getPublishedBuilderStyles } from '@/lib/builder';
import { ConsentManager } from '@/components/consent/consent-manager';
import { SiteAnalyticsBeacon } from '@/components/site-analytics-beacon';
import { TopProgressBar } from '@/components/top-progress-bar';
import { ChatWidget } from '@sparx/chat-widget';
import { MadeWithSparx } from '@sparx/ui';
import { ChunkReloadGuard } from '@sparx/app-kit';
import { mediaUrl } from '@/lib/media';
import { ogImageUrl } from '@/lib/og';
import { resolveActivePropertySlug, resolveSite, type SiteTheme } from '@/lib/site-context';
import { buildCommerceSiteThemeCss } from '@/lib/theme';
import { getPublishedSite, type PublishedSnapshot } from '@/lib/site';

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

// The nav-menu → header-items and nav-menu → footer-columns mappers that lived here,
// plus the `blankToNull` config helper, went with the `<SiteHeader>` / `<SiteFooter>`
// chrome they fed. A silica frame authors its nav and footer as real nodes, so there is
// nothing left to map a `NavNode` INTO.

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

  // Three INDEPENDENT reads, awaited together (docs/127 §9). They were sequential once,
  // so chrome sat several api-rest round-trips deep before it could render. None of
  // them feeds another:
  //
  //   · snapshot      — the legacy Site Builder publish snapshot. Read ONLY for the
  //                     appearance policy + the compiled theme now; its header/footer
  //                     layout blocks went with the chrome tiers that consumed them
  //   · silicaFrame   — the silica engine's FRAME (docs/118 Stage 6). Never null once
  //                     `site` resolves: a 404 falls back to the code starter frame
  //   · surfaceCss    — the compiled Surface stylesheet (docs/47 §5): the utilities
  //                     authored as node `class` strings across the published trees.
  //                     '' until class-first authoring is in use
  //
  // A FOURTH read — `getPublishedBuilderLayout` — used to sit here. It fed the deleted
  // `<BuilderSiteChrome>` branch and nothing else, so every request on every route paid
  // for an answer that could not change what rendered.
  const [snapshot, silicaFrame, surfaceCss] = await Promise.all([
    site ? getPublishedSite(site.slug, sitePreviewToken, activePropertySlug ?? undefined) : null,
    site
      ? getPublishedSilicaFrame(
          site.slug,
          sitePreviewToken ? { previewToken: sitePreviewToken } : {}
        )
      : Promise.resolve<PublishedSilicaFrameDto>({ frame: null, symbols: {}, theme: null }),
    site ? getPublishedBuilderStyles(site.slug) : '',
  ]);

  // "This property renders on silica" — NOT "this route has chrome". The two were the
  // same thing until per-page frames (doc 139 §5), and conflating them is a real bug:
  // `silicaActive` gates the silica THEME stylesheet, the web fonts and the accent
  // colour, all of which are site-level. A landing page whose chrome is set to "none"
  // has a null `frame`, so reading that alone would ship it with no theme and no fonts —
  // the one page an author most wants to look designed.
  const silicaActive = Boolean(silicaFrame.frame) || silicaFrame.frameless === true;
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
  //
  // site.theme is the SINGLE source of the look (docs/impl theming-spine plan): a
  // silica-active site ALWAYS resolves to a concrete theme. The authored theme leads;
  // a site that has published no theme falls back to BASE_SILICA_THEME (the sparx Ember
  // base) rather than rendering unthemed. The legacy brand-derived tier
  // (`buildSilicaThemeCss(compiledV2)`) is GONE: brand is identity-only now, so an
  // un-themed site wears the base theme, not a brand-column compile.
  const silicaThemeCss = !silicaActive
    ? ''
    : silicaFrame.theme
      ? buildSilicaThemeCssFromTheme(silicaFrame.theme)
      : buildSilicaThemeCssFromTheme(BASE_SILICA_THEME);

  // The theme driving the chrome OUTSIDE the frame (chat accent, OG, web fonts).
  // Authored theme wins; a silica-active site with no authored theme uses BASE so the
  // chrome never diverges from what `silicaThemeCss` painted. Null only when silica is
  // inactive (a legacy non-silica site).
  const effectiveSilicaTheme = silicaFrame.theme ?? (silicaActive ? BASE_SILICA_THEME : null);

  // The floating chrome that lives OUTSIDE the silica frame — the chat launcher, the
  // OG accent — historically read `site.theme.colorPrimary`, the LEGACY brand-compiled
  // primary. On a silica-framed site that diverges from what the visitor actually sees:
  // the legacy value is derived from the tenant Brand record, not the authored silica
  // theme, so a tenant whose silica theme is (say) Ember still got an indigo chat
  // bubble. Prefer the silica theme's own `--color-primary` when silica is active.
  const silicaThemePrimary = silicaActive
    ? effectiveSilicaTheme?.tokens?.['--color-primary']
    : undefined;

  // The fonts to load, or the storefront renders every theme in the Geist fallback.
  // The AUTHORED silica theme leads: a typeface/heading font picked in the builder's
  // Design inspector lives ONLY in that theme (`--font-head` + `theme.fonts`), not the
  // brand columns — so reading just the columns names the font but never loads it.
  // Compiled snapshot + brand columns follow as the backstop for a brand-derived
  // theme; `brandFontHref` de-dupes the overlap.
  const fontHref = brandFontHref([
    ...(silicaActive && effectiveSilicaTheme ? themeFontFamilies(effectiveSilicaTheme) : []),
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

  // ── What used to live here ───────────────────────────────────────────────────
  // Roughly ninety lines that existed ONLY to feed the two deleted chrome tiers: the
  // snapshot's header/footer/announcement layout blocks, a default nav derived from the
  // tenant's collections, three hardcoded footer columns, and two navigation-menu reads
  // that overrode them. All of it fed `<SiteHeader>` / `<SiteFooter>`, which could not
  // render (see the chrome branch below). A silica frame carries its own nav and footer
  // as authored nodes.
  //
  // Deleting it removes THREE api-rest round trips from every single page load — one
  // `listCollections` plus up to two `getNavigationMenu` — and the whole
  // `getPublishedBuilderLayout` read below, on a path the root layout pays on every
  // request.

  // Legal pages (privacy/terms/cookie-policy/…) resolve from doc placements (docs/42).
  // This survived the deletion because the SILICA frame needs it too: its footer carries
  // a `site.legal-links` host core rather than a hand-authored column.
  //
  // The guard was `if (site && !builderLayout)` — a leftover from when a published
  // sparx-Builder layout suppressed the default footer. That had become an actual bug
  // rather than dead weight: a tenant who still had a builder layout row got an EMPTY
  // legal-links core on a silica frame that renders regardless.
  const legalLinks: LegalLink[] = site
    ? await getLegalFooterLinks(site.slug, activePropertySlug ?? undefined)
    : [];

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
      <body className="antialiased">
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
                  <div className="flex min-h-[100dvh] flex-col">
                    {/* The silica engine's frame owns the chrome (docs/118 Stage 6): the
                        routed page drops at the frame's own Outlet, and the frame carries
                        its own <main> landmark (id="st-main"), so children pass in
                        directly with no second <main> wrapper.

                        There is no `silicaActive` ternary here any more. Two alternatives
                        used to follow — a published sparx-Builder layout, then a
                        hand-built SiteHeader/SiteFooter pair — and inside this `site ?`
                        branch neither could ever run: `getPublishedSilicaFrame` answers a
                        404 with the code-authored starter frame, so `silicaFrame.frame` is
                        non-null whenever `site` is. The no-site case is the `:` arm at the
                        bottom of this file and is unaffected. */}
                    {silicaFrame.frame ? (
                      <SilicaChrome
                        frame={silicaFrame.frame.root}
                        symbols={silicaFrame.symbols}
                        host={silicaHost?.resolver}
                        // The chrome's host cores (the brand mark) render live from the
                        // resolved site, so Site settings reach the header with no
                        // re-publish.
                        renderHost={storefrontHostRenderer({
                          site,
                          ...(activePropertySlug ? { propertySlug: activePropertySlug } : {}),
                          // So a `site.theme-toggle` host in the frame mounts the real
                          // cookie-backed switch — and hides itself unless the policy is `toggle`.
                          appearance: { policy, initial: initialTheme },
                          // So a `site.legal-links` host in the frame's footer lists the
                          // legal pages this tenant has actually published (and nothing
                          // when they have none) instead of hardcoded links that 404.
                          legalLinks,
                        })}
                      >
                        {children}
                      </SilicaChrome>
                    ) : (
                      // THE LANDING PAGE. This was unreachable while every page wore the
                      // site's one frame; per-page frames (doc 139 §5) made it the real
                      // rendering path for a page whose chrome is set to "none" — a
                      // campaign page with no header and no footer, which the platform
                      // could not express at all before.
                      //
                      // Still a bare landmark rather than a throw, for the case that IS
                      // unreachable (no frame and no `frameless`): the root layout wraps
                      // every route, so failing here would take the whole storefront down
                      // instead of one page.
                      <main
                        className="flex-[1_0_auto] focus:outline-none"
                        id="st-main"
                        tabIndex={-1}
                      >
                        {children}
                      </main>
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
                      accentColor={silicaThemePrimary ?? site.theme?.colorPrimary ?? null}
                    />
                  ) : null}
                </StorefrontBuilderRuntime>
              </CartProvider>
            </WishlistProvider>
          </CustomerProvider>
        ) : (
          <div className="flex min-h-[100dvh] flex-col">
            <main className="flex-[1_0_auto] focus:outline-none">{children}</main>
          </div>
        )}
      </body>
    </html>
  );
}
