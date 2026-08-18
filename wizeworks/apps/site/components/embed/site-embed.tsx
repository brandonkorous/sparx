// The `site.embed` host core (docs/122) — anything from another site that is not a
// video and not a map: a booking calendar, an order form, a reservation widget.
//
// WHY THIS IS SPARX'S RATHER THAN THE ENGINE'S. silicaui's `Embed` frames exactly three
// things — YouTube, Vimeo, and Google's own `/maps/embed` string — and renders everything
// else as a plain anchor. Sound default for an engine; not a general embed. The previous
// sparx builder shipped one (the `bx-*` Embed section, still in this app), so leaving it
// out would be a capability the platform used to have and lost.
//
// THE SAFETY STORY IS DIFFERENT from the video block's, and worth being explicit about,
// because this one frames a URL the author chose rather than an id the platform
// extracted. Three things carry it:
//
//   · https only. An http frame inside an https page is blocked as mixed content
//     anyway, so allowing it would only ever produce a silently blank box.
//   · The sandbox. It withholds the part that matters — top-level navigation, so an
//     embed cannot redirect the whole site out from under a visitor — plus downloads
//     and pointer lock.
//   · The target's own `X-Frame-Options` / `frame-ancestors`, which is the real gate. A
//     site that does not want to be embedded refuses, which is why a passthrough is not
//     a way to frame somebody else's login page.
//
// RENDERS NOTHING WHEN THERE IS NO LINK. A block whose field is still empty is silence
// on the live site, never an empty bordered box. The author is told instead, in the two
// places they will look: the builder canvas draws a labelled prompt, and the pre-publish
// check raises a finding naming the page.
//
// A server component: nothing here is stateful, so there is no client bundle.

import { frameEmbedSrc, frameRatioClass } from '@wizeworks/silica-catalog';

export function SiteEmbed({ props }: { props?: Record<string, unknown> }) {
  const src = frameEmbedSrc(props?.url);
  if (!src) return null;

  const title =
    typeof props?.title === 'string' && props.title.trim() !== ''
      ? props.title.trim()
      : 'Embedded content';

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
        // what a booking widget needs to reach its own API, not access to the tenant's
        // page. `allow-forms` is the point of the block — a form nobody can submit is
        // not an embed of anything.
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
        // No `allow` list and no fullscreen: a booking calendar has no use for the
        // camera, the microphone or taking over the screen, and the safe default for a
        // capability nobody asked for is to withhold it.
      />
    </div>
  );
}
