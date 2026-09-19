'use client';

// What each CHROME core looks like on the studio canvas, drawn at its REAL size.
//
// These live in a navbar or a footer column, and a dashed labelled card there is not a
// preview, it is a lie about the footprint: a 24px icon button drawn as a 120px box
// blows the navbar apart and the author styles around a shape that will never exist.
//
// Nothing here is interactive: every mark is a <span>, never a real <button>/<a>, so a
// click selects the node in the builder instead of firing the control.
//
// Dispatch lives in `host-cores.tsx`; page-sized TRANSACTION cores get a skeleton there.

import type { HostNode } from '@wizeworks/silicaui-html';
import {
  HOST_KEYS,
  frameEmbedSrc,
  frameRatioClass,
  mapEmbedSrc,
  type HostComponentMeta,
} from '@wizeworks/silica-catalog';

import { PlatformMark, hasPlatformMark } from '../../components/platform-mark';

/** The tenant's real brand mark — logo and/or name, exactly as the live site's
 *  `site.brand` core renders it, read from the resolver root `site.identity` that
 *  `buildPreviewRoot` overlays. Degrades: logo-only with no logo → the name; no name
 *  → "Your site". Never an empty tile. */
export function BrandMark({ root, node }: { root: unknown; node: HostNode }) {
  const identity = (root as { site?: { identity?: { name?: unknown; logo?: unknown } } })?.site
    ?.identity;
  const name = typeof identity?.name === 'string' && identity.name ? identity.name : 'Your site';
  const logo = identity?.logo as { url?: unknown } | null | undefined;
  const logoUrl = typeof logo?.url === 'string' && logo.url ? logo.url : null;
  const show =
    node.props?.show === 'logo' || node.props?.show === 'name' ? node.props.show : 'both';
  // Mirror the live site's degradation: "logo only" with no logo would render an
  // empty box, so fall back to the name.
  const mode = show === 'logo' && !logoUrl ? 'name' : show;

  return (
    <span className="inline-flex items-center gap-2.5">
      {logoUrl && (mode === 'logo' || mode === 'both') ? (
        // A raw <img>, not next/image: an arbitrary tenant media URL (usually an SVG),
        // which the optimizer can't process. Decorative here — the name renders
        // alongside in "both" — so alt is empty.
        <img src={logoUrl} alt="" className="h-8 w-auto object-contain" />
      ) : null}
      {mode === 'name' || mode === 'both' ? (
        <span className="text-lg font-semibold">{name}</span>
      ) : null}
    </span>
  );
}

/** The light/dark switch at its real size — the live site mounts an icon button, so
 *  the canvas draws an icon button. A `<span>` carrying the button classes rather than
 *  a `<button>`: it must not be clickable on the canvas (selection belongs to the
 *  builder) and it has no state to show, so the moon glyph stands for the control the
 *  way a light-mode visitor first sees it.
 *
 *  Always drawn, even under a single-theme appearance policy that would hide it live —
 *  a node you cannot see is a node you cannot place, and the `title` below says when it
 *  appears. (That tooltip is the ONLY place the hint reaches an author: the engine drops
 *  `hint` when it builds palette rows.) Same call the Builder-path `ThemeToggle` makes. */
export function ThemeToggleMark({ hint }: { hint: string }) {
  return (
    <span className="btn btn-ghost btn-sm" title={hint}>
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    </span>
  );
}

/** The account link at its real size — a short text link in a navbar row.
 *
 *  Representative, and it has to be: live, this reads "Sign in" to a visitor and the
 *  customer's own first name once she is signed in, and the canvas has no visitor. It
 *  draws the signed-out word because that is the one every author will see on their own
 *  published site, and the `title` says what the other state is. */
export function AccountLinkMark({ hint }: { hint: string }) {
  return (
    <span className="text-sm font-medium" title={hint}>
      Sign in
    </span>
  );
}

/** The legal-links column at its real size — a heading plus the links themselves.
 *
 *  The labels are REPRESENTATIVE, not the tenant's own: unlike `site.brand`, whose data
 *  is already in the canvas resolver root, legal placements are a separate read the
 *  studio doesn't make. Three of the six kinds, in the order the checklist lists them,
 *  so the author sees the column's true shape and rhythm. What actually renders is
 *  whatever they've published (and nothing at all until they publish one) — the `title`
 *  says so, and it is the only place that does; the palette drops the hint. */
export function LegalLinksColumn({ heading, hint }: { heading: string; hint: string }) {
  return (
    // Its own flex column rather than `display:contents`, which generates no box and
    // so would swallow the tooltip. Nesting a column inside the node's own column
    // costs nothing visually.
    <span className="flex flex-col gap-3" title={hint}>
      {heading ? <h3 className="text-sm font-semibold">{heading}</h3> : null}
      {['Privacy Policy', 'Terms of Service', 'Cookie Policy'].map((label) => (
        <span key={label} className="text-sm">
          {label}
        </span>
      ))}
    </span>
  );
}

/** The page-links pager at its real size — Prev, a short run of numbers with the
 *  current one filled, Next.
 *
 *  Representative, and it has to be: on the live site this control renders NOTHING
 *  until there is more than one page of something, and drawing an empty box on the
 *  canvas would make an author think they had placed it wrong. So the canvas shows
 *  the shape it takes when it does appear, and the `title` says what decides that. */
export function PagerMark({ hint }: { hint: string }) {
  return (
    <span className="flex flex-wrap items-center justify-center gap-2" title={hint}>
      <span className="btn btn-ghost btn-sm">← Prev</span>
      {['1', '2', '3'].map((n) => (
        <span key={n} className={n === '1' ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'}>
          {n}
        </span>
      ))}
      <span className="btn btn-ghost btn-sm">Next →</span>
    </span>
  );
}

/**
 * A map or a general embed at its REAL footprint.
 *
 * Sized rather than skeletal, and that is the whole point: the author's only decision
 * here is how big a hole this leaves in their layout, and a dashed card of some other
 * height answers the wrong question. So it draws the real ratio box, the real rounding,
 * the real surface.
 *
 * NOT the live frame, though. A third-party iframe on the canvas would run someone
 * else's scripts inside the builder, reload on every keystroke that re-renders, and
 * swallow the clicks that are supposed to SELECT the block.
 *
 * The UNRESOLVED state is the one that earns its words. Both of these render NOTHING on
 * the live site until their field is filled in, so a silent grey box here would read as
 * "placed wrong" when the truth is "not finished yet". It says which, and it names WHERE
 * to fix it — the props live under the inspector's **Settings** tab, not on Design.
 */
export function FrameMark({ node, meta }: { node: HostNode; meta?: HostComponentMeta }) {
  const props = node.props ?? {};
  const isMap = node.component === HOST_KEYS.siteMap;
  const resolved = isMap
    ? mapEmbedSrc(props.location, props.zoom) !== null
    : frameEmbedSrc(props.url) !== null;

  return (
    <span
      className={`rounded-box bg-base-200 text-base-content flex w-full items-center justify-center border p-6 text-center ${frameRatioClass(
        props.ratio
      )} ${resolved ? 'border-base-300' : 'border-base-content/25 border-dashed'}`}
      title={meta?.hint ?? node.component}
    >
      <span className="text-sm font-medium">
        {resolved
          ? isMap
            ? 'Your map shows here'
            : 'Your embed shows here'
          : isMap
            ? 'Type your address under Settings to show the map here'
            : 'Paste a link under Settings to show it here'}
      </span>
    </span>
  );
}

/**
 * The site's social row at its REAL size — her own accounts, as the live footer draws
 * them.
 *
 * WHY THIS IS A CHROME MARK. It sits in a footer column beside the legal links, and the
 * live control is a wrapped row of small circular ghost buttons about as tall as one
 * line of text. Drawn as a page-sized skeleton it stood 146px tall in a 116px column,
 * which is the exact footprint lie this file exists to stop.
 *
 * REAL DATA, like the brand mark and unlike the legal column. `site.social` is already
 * in the canvas resolver root — `buildPreviewRoot` overlays it from the same chrome read
 * that supplies the name and logo, and even overwrites it when empty — and nothing was
 * drawing it ([[feedback_fetched_but_never_rendered]]). So the author sees HER accounts,
 * in HER order, and can tell at a glance whether the footer is showing what she meant.
 *
 * THE EMPTY CASE DRAWS A SENTENCE, NOT A ROW. The live footer renders nothing at all
 * until she adds one, so inventing three marks here would show her a row she never
 * chose and cannot remove. `FrameMark` already settled this shape for a core whose
 * field is not filled in yet: say which, and name where to fix it.
 *
 * An unknown platform ("Other", or a network with no glyph) draws its own name, exactly
 * as the live `SocialLinks` does — a link is never silently dropped.
 */
export function SocialLinksMark({ root, hint }: { root: unknown; hint: string }) {
  const social = (root as { site?: { social?: unknown } })?.site?.social;
  const items = Array.isArray(social)
    ? social.filter(
        (s): s is { platform: string; url: string } =>
          typeof (s as { platform?: unknown })?.platform === 'string'
      )
    : [];

  if (items.length === 0) {
    return (
      <span
        className="border-base-content/25 text-base-content inline-flex items-center rounded-full border border-dashed px-3 py-1 text-sm"
        title={hint}
      >
        Add your accounts under Site identity to show them here
      </span>
    );
  }

  return (
    // The live row's own classes, so the footer column reflows here exactly as it will
    // on the site. Spans rather than links: a click selects the node in the builder.
    <span className="flex flex-wrap items-center gap-1" title={hint}>
      {items.map((item, i) => {
        const known = hasPlatformMark(item.platform);
        return (
          <span
            key={`${String(i)}-${item.platform}`}
            className={known ? 'btn btn-ghost btn-sm btn-circle' : 'btn btn-ghost btn-sm'}
          >
            {known ? (
              <PlatformMark platform={item.platform} tone="ink" className="size-5" />
            ) : (
              item.platform
            )}
          </span>
        );
      })}
    </span>
  );
}

/** The save-for-later heart at its REAL size — a single control that sits beside the
 *  Add-to-cart button, not a page-sized band.
 *
 *  It is filed under "Your shop" rather than "Your site", so `check:host-cores` does not
 *  require a mark for it — but the reason the check exists applies exactly: a 40px
 *  control drawn as a dashed page-width card blows the buy box apart on the canvas and
 *  the author styles around a shape that will never exist. The rule is about SIZE, and
 *  this one is small. */
export function SaveForLaterMark({ hint, label }: { hint: string; label: string }) {
  return (
    <span
      className="rounded-field border-base-300 text-base-content inline-flex items-center gap-2 border px-3 py-2 text-base"
      title={hint}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
      </svg>
      <span>{label}</span>
    </span>
  );
}
