// site root layout. Resolves the tenant from the Host, injects the tenant's theme
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
// "site not found" messaging.

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
import { SiteHostRenderer } from '@/components/silica-host-cores';
import { SilicaBehaviors } from '@/components/silica-behaviors';
import { SiteBuilderRuntime } from '@/components/site-builder-runtime';
import type { PublishedSilicaFrameDto } from '@sparx/builder-schemas';
import { getPublishedSilicaFrame } from '@/lib/silica';
import { buildSilicaHost, silicaSiteIdentity } from '@/lib/silica-data';
import { buildSilicaThemeCssFromTheme, brandFontHref, themeFontFamilies } from '@sparx/site-themes';
import { BASE_SILICA_THEME, buildCustomColorCss } from '@sparx/silica-catalog';
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
import { resolveActivePropertySlug, resolveSite } from '@/lib/site-context';
import { getPublishedSite } from '@/lib/site';

// MUST be first: declares the cascade-layer order, so the site's own
// element defaults in site.css rank BENEATH silica's `components` layer and can't
// shadow a themeable control. See layers.css.
import './layers.css';
import './globals.css';
import './site.css';
// The custom-section template primitives (bx-tpl-*), shared with the dashboard
// Section Studio preview so both render identically (docs/38 Phase C).
import '@sparx/section-template-react/section-template.css';

const THEME_COOKIE = 'sparx_theme';

export async function generateMetadata(): Promise<Metadata> {
  const site = await resolveSite();
  if (!site) {
    return {
      title: 'Site not found',
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
    // brand-new site still looks finished. Deliberately favicon-only: no
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
// There is ONE theme payload now: `silicaThemeCss` below, silicaui's own
// `--color-*` / `--radius-*` / `--font-*` vocabulary, projected from the site's
// authored theme (docs/118 §1.0 north star).
//
// A second `themeCss` used to ship alongside it on every request — the Token Model
// v2 engine's `--st-*` emitter, compiled from the brand columns plus the legacy v1
// `draftSettings.tokens` overlay. Two populated token sets meant two answers to
// "what colour is primary?", reconciled by whichever `:root` block happened to win
// the cascade — so an applied theme could silently keep the previous palette, and
// site fonts could never change at all (silica deliberately does not emit
// `--font-head`, leaving the legacy `--st-font-*` unopposed).
// Retired in docs/implementation/st-token-retirement.md.

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
// added), avoiding any flash of invisible content. `bx-reveal-ready` gates the
// legacy section path; `bx-anim-ready` gates the docs/61 Builder motion
// (`.bx-reveal` + SCROLL_MOTION_CSS, driven by MotionController).
const REVEAL_INIT_SCRIPT = `(function(){try{if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;document.documentElement.classList.add('bx-reveal-ready','bx-anim-ready');}catch(e){}})();`;

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
  // WHOLE document and short-circuit ALL site chrome + data reads below. A
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
  //
  // All three take the preview token, INCLUDING the stylesheet. It was the one read here
  // that didn't, so preview rendered the DRAFT chrome against the PUBLISHED sheet — the
  // markup carried a class the author had just typed and no rule existed for it. That is
  // precisely the case preview exists to show, and it silently showed the old design
  // instead of the new one. The catch-all route patched this for its own body by
  // injecting a second <style>; the chrome, and every other route, had no such patch.
  const [snapshot, silicaFrame, surfaceCss] = await Promise.all([
    site ? getPublishedSite(site.slug, sitePreviewToken, activePropertySlug ?? undefined) : null,
    site
      ? getPublishedSilicaFrame(
          site.slug,
          sitePreviewToken ? { previewToken: sitePreviewToken } : {}
        )
      : Promise.resolve<PublishedSilicaFrameDto>({ frame: null, symbols: {}, theme: null }),
    site
      ? getPublishedBuilderStyles(
          site.slug,
          sitePreviewToken ? { previewToken: sitePreviewToken } : {}
        )
      : '',
  ]);

  // NOTE — `silicaActive` (`Boolean(frame) || frameless === true`) used to live here,
  // gating the theme stylesheet, the web fonts and the accent colour. It existed to
  // separate "this property renders on silica" from "this route has chrome", because a
  // landing page with chrome set to "none" has a null `frame` and reading that alone
  // shipped it with no theme and no fonts — the one page an author most wants to look
  // designed. All three are now resolved UNCONDITIONALLY off `silicaFrame.theme ??
  // BASE_SILICA_THEME`, which answers that concern outright: there is no branch left to
  // get wrong, and no page can render unthemed. Don't reintroduce the gate.
  // Depends on silicaFrame, so it stays sequential behind it.
  const silicaHost =
    site && silicaFrame.frame
      ? await buildSilicaHost(site.slug, silicaFrame.frame.root, {
          currency: site.commerce.defaultCurrency,
          locale: site.commerce.defaultLocale,
          // The frame binds site.* (brand name, logo, tagline, socials, contact
          // details) — supply it so the navbar/footer render the tenant's identity,
          // not a placeholder. Every field Site settings COLLECTS must be supplied
          // here: a declared binding the host never fills resolves empty, and an
          // empty value blanks the node it is bound to. Shared with the page routes
          // via `silicaSiteIdentity` so the two can't drift.
          site: silicaSiteIdentity(site),
        })
      : null;

  // The per-tenant silica theme file (docs/118 §1.0 north star): silicaui's own
  // token vocabulary (`--color-primary`, `--radius-box`, …) so every generated
  // silica class resolves with no per-tenant CSS compile. This is now the ONLY
  // source of tenant colour and type on the site.
  //
  // site.theme is the SINGLE source of the look (docs/impl theming-spine plan): a
  // site ALWAYS resolves to a concrete theme. The authored theme leads; a site that
  // has published no theme falls back to BASE_SILICA_THEME (the sparx Ember base)
  // rather than rendering unthemed. The legacy brand-derived tier
  // (`buildSilicaThemeCss(compiledV2)`) is GONE: brand is identity-only now, so an
  // un-themed site wears the base theme, not a brand-column compile.
  //
  // Emitted UNCONDITIONALLY, not gated on `silicaActive`. It used to be gated, which
  // was safe only while the legacy `--st-*` payload shipped alongside to clothe a
  // non-silica page; with that retired, gating would mean a page rendering with no
  // theme at all. `getPublishedSilicaFrame` falls back to the code starter frame, so
  // in practice every served site is silica-active anyway — this makes the theme
  // unconditional rather than resting on that.
  const silicaThemeCss = buildSilicaThemeCssFromTheme(silicaFrame.theme ?? BASE_SILICA_THEME);

  // Colors the AUTHOR invented. The theme file above declares `--color-<name>` for
  // one, but the classes that CONSUME it (`btn-brand`, `bg-brand`, `badge-brand`)
  // come from silicaui's Tailwind plugin, whose `colors:` list is fixed in
  // `globals.css` at build time and cannot know a name coined later in the theme
  // editor. So a custom color previewed correctly on the canvas (which hydrates its
  // own scoped rules) and then shipped UNSTYLED — nothing rejected the class, it
  // simply matched no rule. `buildCustomColorCss` recovers exactly the rules a
  // build-time registration would have produced, plus the measured `-content` ink
  // the author never typed. Empty for the overwhelmingly common no-custom-color
  // theme, so this costs one token scan on the normal path.
  const silicaCustomColorCss = silicaFrame.theme ? buildCustomColorCss(silicaFrame.theme) : '';

  // The theme driving the chrome OUTSIDE the frame (chat accent, OG, web fonts).
  // Authored theme wins, else BASE — the SAME resolution `silicaThemeCss` uses above,
  // so the chrome can never diverge from what the frame was painted with.
  const effectiveSilicaTheme = silicaFrame.theme ?? BASE_SILICA_THEME;

  // The floating chrome that lives OUTSIDE the silica frame — the chat launcher, the
  // OG accent — historically read `site.theme.colorPrimary`, the LEGACY brand-compiled
  // primary. On a silica-framed site that diverges from what the visitor actually sees:
  // the legacy value is derived from the tenant Brand record, not the authored silica
  // theme, so a tenant whose silica theme is (say) Ember still got an indigo chat
  // bubble. The rendered theme's own `--color-primary` is the truth.
  const silicaThemePrimary = effectiveSilicaTheme.tokens?.['--color-primary'];

  // The fonts to load, or the site renders every theme in the Geist fallback.
  // The AUTHORED silica theme leads: a typeface/heading font picked in the builder's
  // Design inspector lives ONLY in that theme (`--font-head` + `theme.fonts`), not the
  // brand columns — so reading just the columns names the font but never loads it.
  // Compiled snapshot + brand columns follow as the backstop for a brand-derived
  // theme; `brandFontHref` de-dupes the overlap.
  const fontHref = brandFontHref([
    ...themeFontFamilies(effectiveSilicaTheme),
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
  // `sameAs`) and a WebSite with the site search action — so search and
  // answer engines attribute pages to this site and can surface a sitelinks
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
        {silicaThemeCss ? (
          <style data-silica-theme dangerouslySetInnerHTML={{ __html: silicaThemeCss }} />
        ) : null}
        {silicaCustomColorCss ? (
          <style
            data-silica-custom-colors
            dangerouslySetInnerHTML={{ __html: silicaCustomColorCss }}
          />
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
                <SiteBuilderRuntime>
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
                        renderHost={SiteHostRenderer({
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
                      // site's one frame; per-page frames (docs/silicaui/01 §5) made it the real
                      // rendering path for a page whose chrome is set to "none" — a
                      // campaign page with no header and no footer, which the platform
                      // could not express at all before.
                      //
                      // Still a bare landmark rather than a throw, for the case that IS
                      // unreachable (no frame and no `frameless`): the root layout wraps
                      // every route, so failing here would take the whole site down
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
                </SiteBuilderRuntime>
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
