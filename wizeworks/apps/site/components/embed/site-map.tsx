// The `site.map` host core (docs/122) — a map of one place, from the address a business
// owner already has.
//
// THE ONE EMBED SPARX RENDERS ITSELF. Every other frame on a tenant's page is silicaui's
// `Embed` component: the engine owns the iframe, recognises the provider and mints the
// player URL, and a raw `iframe` element stays banned (`element.ts`) and floored to a
// `<div>` (`toHtml`) exactly as it should be. `Embed` accepts a maps link too — by
// passing it through unchanged, which works only for the `output=embed` form nobody has.
// An ordinary Google Maps page URL is answered with `X-Frame-Options` and renders as a
// refused, empty frame.
//
// So this exists to accept an ADDRESS and build a URL that works. If the engine ever
// learns to do that, delete this and stamp an `Embed` — it is compensation for a gap,
// not a design.
//
// RENDERS NOTHING WHEN THERE IS NO PLACE. A block whose field is still empty is silence
// on the live site, never an empty bordered box and never a browser error page. The
// author is told instead, in the two places they will look: the builder canvas draws a
// labelled prompt, and the pre-publish check raises a finding naming the page.
//
// A server component: nothing here is stateful, so there is no client bundle and the
// frame is in the first HTML the browser gets.

import { mapEmbedSrc, frameRatioClass } from '@wizeworks/silica-catalog';

export function SiteMap({ props }: { props?: Record<string, unknown> }) {
  const src = mapEmbedSrc(props?.location, props?.zoom);
  if (!src) return null;

  // Never blank. A frame with no accessible name is announced as "frame" and nothing
  // more, so a screen-reader user is told something is there and not what.
  const title =
    typeof props?.title === 'string' && props.title.trim() !== '' ? props.title.trim() : 'Map';

  return (
    <div
      className={`rounded-box border-base-300 bg-base-200 relative w-full overflow-hidden border ${frameRatioClass(props?.ratio)}`}
    >
      <iframe
        className="absolute inset-0 h-full w-full border-0"
        src={src}
        title={title}
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        // `allow-same-origin` beside `allow-scripts` reads alarming and is not, for a
        // CROSS-origin frame: it grants the embedded document its OWN origin, which is
        // what Google's map needs to reach its own APIs, not access to the tenant's
        // page. What the sandbox still withholds is the part that matters — top-level
        // navigation, so an embed cannot redirect the whole site out from under a
        // visitor — plus downloads and pointer lock.
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        allowFullScreen
      />
    </div>
  );
}
