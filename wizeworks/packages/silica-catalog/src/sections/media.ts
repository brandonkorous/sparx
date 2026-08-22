// Video, a map, and anything else from another site — the three blocks a business owner
// looks for and could not find.
//
// WHY THESE WERE MISSING, since it is not obvious from the palette. silicaui ships an
// `Embed` component and it is the ONLY sanctioned `<iframe>` on the platform: a raw
// `iframe` element is on `element.ts`'s never-list and `toHtml` floors one to a `<div>`,
// both correctly, because a tenant-authored frame src is an arbitrary third-party
// document running inside their customers' session. `Embed` inverts that — the author
// supplies a link, the ENGINE recognises the provider and mints the player URL, and an
// unrecognised host degrades to a plain link rather than a frame.
//
// But the engine ships no PALETTE entry for it, and sparx's catalog never added one. So
// the capability was fully built, fully safe, and unreachable: 74 blocks in the Add
// palette and no way to put a video on a page. The previous builder had an Embed
// section; the silica rebuild dropped it, which turned "put my intro video on my
// homepage" from unstyled into impossible.
//
// ONLY THE VIDEO/AUDIO BLOCK IS AN `Embed`, THOUGH, and getting that wrong is easy — it
// was got wrong here once. The engine frames a recognised set of providers and renders
// everything else as a plain anchor. On 0.50 that set is YouTube and Vimeo (video),
// Spotify / SoundCloud / Apple Music / Apple Podcasts (audio + podcast), and Google's own
// `/maps/embed?pb=…` string. So:
//
//   · Video & audio → a stamped `Embed`. YouTube and Vimeo (Shorts, playlists, start
//                     times, unlisted — 0.49) AND, since 0.50, a Spotify/SoundCloud/Apple
//                     track, album, playlist or podcast episode. One block: the engine
//                     recognises the provider from the pasted link.
//   · Map           → the `site.map` HOST core. An ordinary Google Maps page link and a
//                     plain ADDRESS both become anchors through the engine, and an address
//                     is the only thing a shop owner actually has.
//   · Embed         → the `site.embed` HOST core. A booking calendar, an order form, a
//                     donation page — the engine links all of them, which would make this
//                     block a link on its own headline use case.
//
// Both cores are compensation for a gap, not a design: if the engine ever frames these,
// delete them and stamp an `Embed`. See `host-nodes.ts`.

import { el, type Node } from '@wizeworks/silicaui-html';

import { hostCore, HOST_KEYS } from '../host-nodes';
import { section, sectionHead } from './_shell';
import type { CatalogGroup } from '../types';

/**
 * A framed third-party embed inside the standard section shell.
 *
 * `ratio` is the engine's own vocabulary, not a ratio string: silicaui accepts `video`
 * and `square` and falls back to `video` for everything else — so `4:3` and `21:9`
 * SILENTLY become widescreen. Passing one of those would look like a working control
 * and behave like a broken one, which is why only the two real values appear here.
 *
 * `title` is seeded with a real sentence rather than left blank. A frame with no
 * accessible name is announced as "frame" and nothing more, so a screen-reader user is
 * told something is there and not what — and a blank default ships on every untouched
 * block, which is the case that would actually happen.
 */
function embed(opts: {
  heading: string;
  lead: string;
  title: string;
  ratio?: 'video' | 'square';
}): Node {
  return section([
    sectionHead(opts.heading, opts.lead),
    {
      kind: 'component',
      component: 'Embed',
      class: 'w-full',
      // `url` empty on purpose: the author pastes theirs. Until they do, the engine
      // draws its own "add a link" prompt — which is why the pre-publish check reports
      // an empty embed rather than letting that prompt reach a visitor.
      props: { url: '', title: opts.title, ratio: opts.ratio ?? 'video' },
    },
  ]);
}

/** The video-or-audio block: an `Embed` under a heading.
 *
 *  The seeded copy covers BOTH, because the block does. It was written when the engine
 *  framed video only, and when audio providers were added the palette row and its hint
 *  were updated while this heading still said "Watch" over a lead about "a short film" —
 *  so an owner who inserted it to embed their podcast got a block telling them to make a
 *  video. Seeded copy is the block's real first impression; it moves with the block. */
export function videoBlock(): Node {
  return embed({
    heading: 'Watch or listen',
    lead: 'A few minutes of you talking does more than a page of copy — an introduction, a walkthrough, an episode, a customer telling their own story.',
    title: 'Video or audio',
  });
}

/**
 * The general embed — a booking calendar, an order form, a reservation widget.
 *
 * NOT an `Embed`, and this was got wrong once. The engine frames only a recognised set of
 * providers (YouTube, Vimeo, the audio players, Google's `/maps/embed` string) and renders
 * everything else as a plain anchor — so a block advertising "your booking calendar, right
 * here" built on `Embed` would deliver a link to click, on its own headline use case. It
 * stamps the `site.embed` HOST core, which frames any https URL under a sandbox.
 */
export function embedBlock(): Node {
  return section([
    sectionHead(
      'Book a time',
      'Your booking calendar, order form or playlist, shown right here so nobody has to leave the page.'
    ),
    hostCore(HOST_KEYS.siteEmbed, 'w-full', {
      url: '',
      title: 'Embedded content',
      ratio: 'classic',
    }),
  ]);
}

/** The map block: a heading, the address as readable text, and the live map beside it.
 *
 *  The ADDRESS STAYS AS TEXT, not only inside the map. A map is a picture: it cannot be
 *  copied into a phone, read by a screen reader, or seen at all by a visitor whose
 *  browser blocks third-party frames. `find_us` in `place.ts` is the text-only version
 *  of this and stays the right block for a site that wants no frame at all. */
export function mapBlock(): Node {
  return section([
    sectionHead('Where to find us', 'Come and see us — here is exactly where we are.'),
    el('div', 'flex flex-col gap-8 @3xl:flex-row @3xl:items-start', {
      children: [
        el('address', 'flex flex-col gap-2 text-base not-italic text-base-content @3xl:w-64', {
          children: [
            el('span', 'text-lg font-semibold', { text: 'Your business name' }),
            el('span', '', { text: '123 Example Street' }),
            el('span', '', { text: 'Your town, POST CODE' }),
            el('a', 'link link-primary', { text: 'Call us', attrs: { href: 'tel:+15551234567' } }),
          ],
        }),
        hostCore(HOST_KEYS.siteMap, 'w-full @3xl:flex-1', {
          location: '',
          title: 'Map',
          zoom: 15,
          ratio: 'classic',
        }),
      ],
    }),
  ]);
}

/** The palette group. `media` is its own group rather than folded into `sparx_place` or
 *  `sparx_content` because it is what an author goes LOOKING for by name — "how do I add
 *  a video" is a question about a thing, not about a page section. */
export const MEDIA_CATALOG: CatalogGroup[] = [
  {
    key: 'sparx_media',
    label: 'Video, audio & maps',
    items: [
      {
        key: 'video_embed',
        label: 'Video or audio',
        icon: 'play',
        hint: 'A video from YouTube or Vimeo, or music and podcasts from Spotify, SoundCloud or Apple. Paste the link from your browser’s address bar — the Share link works too.',
        make: videoBlock,
      },
      {
        key: 'map_embed',
        label: 'Map',
        // The curated icon set has no map or pin glyph, and an UNREGISTERED name renders
        // as an empty span (silently invisible). `contact` is the registered one that
        // means this: a map is the contact page's "where we are".
        icon: 'contact',
        hint: 'Your address on a map, next to it in words. Type the address — visitors can zoom it and get directions.',
        make: mapBlock,
      },
      {
        key: 'other_embed',
        label: 'Embed from another site',
        icon: 'code',
        hint: 'A booking calendar, an order form, a donation page. Paste its link. Some sites don’t allow this — if nothing shows, that site has blocked it.',
        make: embedBlock,
      },
    ],
  },
];
