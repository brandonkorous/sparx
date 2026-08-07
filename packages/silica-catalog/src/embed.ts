// What happens to a link a business owner pastes into a Video or Embed block — and the
// one thing sparx builds on top, which is turning a plain ADDRESS into a working map.
//
// THE ENGINE OWNS THE EMBED. silicaui ships an `Embed` component, and it is the ONLY
// sanctioned `<iframe>` on the platform: `element.ts` bans the raw tag and `toHtml`
// floors a hand-authored one to a `<div>`, both correctly, because a tenant-authored
// frame src is an arbitrary third-party document running inside their customers'
// session. `Embed` inverts that — the author supplies a link, the ENGINE recognises the
// provider and mints the player URL, and an unrecognised host degrades to a plain link
// rather than a frame. So a video block is a stamped `Embed`, not something sparx
// renders, and this file does not re-implement any of it.
//
// WHAT IT DOES INSTEAD, and why each half exists:
//
//   1. `embedOutcome` — a MODEL of what the engine will do with a given URL, so the
//      pre-publish check can tell an author their link will not play BEFORE they ship it.
//      The engine has no "will this work?" call, and the ways it declines are quiet: a
//      channel page, a search result, or a Google Maps link all render as a plain
//      anchor, which looks like a styling problem rather than an answer.
//
//      A model of someone else's behaviour drifts, and this one already has. On 0.47 the
//      list of things it could not play was long — Shorts, livestreams, playlists, Vimeo
//      channel links, an unlisted video's private hash, a start time — and 0.49 fixed
//      every one of them. 0.50 then WIDENED the engine past video: Spotify, SoundCloud,
//      Apple Music and Apple Podcasts now mint an audio/podcast player (the new `audio`
//      kind), where before they rendered as a plain anchor. The only reason a change like
//      that is caught on the day of the upgrade rather than months later, through a tenant,
//      is that `embed.test.ts` asserts this model against the REAL renderer for every case.
//      Keep that property: a new case goes in the table there, never only here.
//
//   2. `mapEmbedSrc` — the `site.map` host core's URL builder, and the one embed sparx
//      renders itself. `Embed` frames exactly one map form, the `/maps/embed?pb=…` string
//      behind Google's "Embed a map" button; an ordinary map page, a `?q=…&output=embed`
//      URL and a plain ADDRESS all become links. An address is the only one of those a
//      shop owner actually has.
//
// React-free, like the rest of this package: the check, the canvas and the live site all
// need it.

/* ── What the engine will do with a link ──────────────────────────────────────── */

/** What the engine renders for a pasted link.
 *
 *  `video` is a YouTube/Vimeo player; `audio` is an audio/podcast player (Spotify,
 *  SoundCloud, Apple Music, Apple Podcasts) — a distinct kind because the pre-publish
 *  check says "this plays as an audio player", not "as a video". Both are `<iframe>`s.
 *  `link` is its fallback for anything it will not frame — a real anchor, not a broken
 *  frame, which is the right call and still usually not what the author wanted. `frame`
 *  is a URL it passes through unchanged (Google's own map-embed string). `empty` is a
 *  block with nothing typed in it yet, which renders as an empty `<div>`: nothing reaches
 *  a visitor, and nothing tells the author either. */
export type EmbedKind = 'video' | 'audio' | 'frame' | 'link' | 'empty';

export interface EmbedOutcome {
  kind: EmbedKind;
  /** Present only when the engine framed or linked something in a way that will not do
   *  what the author meant. One case survives on 0.49 — see `map-not-embeddable`. */
  degraded?: 'map-not-embeddable';
}

/** Parse a URL without throwing on the many things that are not one. */
function asUrl(value: unknown): URL | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  try {
    const url = new URL(value.trim());
    // http(s) only. A `javascript:` or `data:` string is not a link someone pasted from
    // a video site, and there is no reason for either to reach a provider matcher.
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

/** `youtube.com`, `www.youtube.com`, `m.youtube.com` — but never `notyoutube.com`. */
function hostIs(url: URL, domain: string): boolean {
  const host = url.hostname.toLowerCase();
  return host === domain || host.endsWith(`.${domain}`);
}

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_LIST = /^[A-Za-z0-9_-]{2,64}$/;
const VIMEO_ID = /^[0-9]{6,12}$/;

function isYouTube(url: URL): boolean {
  return (
    hostIs(url, 'youtube.com') || hostIs(url, 'youtu.be') || hostIs(url, 'youtube-nocookie.com')
  );
}

/** The YouTube video id, in every shape their own UI hands out — the address bar, the
 *  Share button, a Short, a livestream, an old `/v/` link, and an already-embedded URL. */
function youtubeId(url: URL): string | null {
  const segments = url.pathname.replace(/^\/+/, '').split('/');
  const first = segments[0] ?? '';
  if (hostIs(url, 'youtu.be')) return first === '' ? null : first;
  if (['embed', 'shorts', 'live', 'v'].includes(first)) return segments[1] ?? null;
  return url.searchParams.get('v');
}

/** A Google Maps URL the engine will frame. Exactly one form: the `/maps/embed?pb=…`
 *  string behind Google's own "Embed a map" button. */
function isEmbeddableMap(url: URL): boolean {
  return url.pathname.startsWith('/maps/embed');
}

/** Anything a person would call a map link, including the two that are not on
 *  `google.com` — `maps.google.com` and a shortened `goo.gl`. */
function isMapsHost(url: URL): boolean {
  return (
    (hostIs(url, 'google.com') && url.pathname.startsWith('/maps')) ||
    url.hostname.toLowerCase().startsWith('maps.') ||
    hostIs(url, 'goo.gl')
  );
}

/** The Spotify content kinds the engine mints a player for — a track, an album, a
 *  playlist, and the two podcast shapes (an episode, a show). An artist or user page is
 *  deliberately absent: those are not a single playable thing. */
const SPOTIFY_KINDS = new Set(['track', 'album', 'playlist', 'episode', 'show']);

/**
 * An audio / podcast link the engine turns into a player (an `<iframe>`), added on
 * silicaui 0.50: a Spotify track/album/playlist/episode/show, a SoundCloud resource, an
 * Apple Music album/song, or an Apple Podcasts show/episode.
 *
 * Bandcamp and Simplecast are `embedUrlOnly` on 0.50 — the engine frames only their
 * PRE-BUILT player URL (`bandcamp.com/EmbeddedPlayer/…`, `player.simplecast.com/…`), never
 * the ordinary share link, because it cannot derive the numeric id without an API call. A
 * normal Bandcamp URL therefore stays a `link`, which is the honest thing to model — so
 * they are not matched here (a share link falls through to `link`, exactly as it renders).
 */
function isAudio(url: URL): boolean {
  const seg = url.pathname.replace(/^\/+/, '').split('/').filter(Boolean);
  if (hostIs(url, 'spotify.com')) {
    // `open.spotify.com/<kind>/<id>`, or the already-embedded `/embed/<kind>/<id>`.
    const [a, b, c] = seg;
    return a === 'embed'
      ? SPOTIFY_KINDS.has(b ?? '') && Boolean(c)
      : SPOTIFY_KINDS.has(a ?? '') && Boolean(b);
  }
  // SoundCloud builds a player from the whole URL, so any resource path frames; a bare
  // `soundcloud.com` with no path does not.
  if (hostIs(url, 'soundcloud.com')) return seg.length >= 1;
  // Apple's music/podcasts pages carry a `/<country>/<kind>/…` path; a bare host does not.
  if (hostIs(url, 'music.apple.com') || hostIs(url, 'podcasts.apple.com')) return seg.length >= 2;
  return false;
}

/**
 * What the engine's `Embed` will render for this link.
 *
 * A description, not a proposal. Where the engine declines something it could plausibly
 * handle, this says so rather than quietly being more generous — a check that claims a
 * link plays when it does not is worse than no check.
 */
export function embedOutcome(value: unknown): EmbedOutcome {
  const url = asUrl(value);
  if (!url) return { kind: 'empty' };

  if (isYouTube(url)) {
    const id = youtubeId(url);
    if (id && YOUTUBE_ID.test(id)) return { kind: 'video' };
    // A playlist link carries no video id and embeds as `videoseries`.
    const list = url.searchParams.get('list') ?? '';
    return YOUTUBE_LIST.test(list) ? { kind: 'video' } : { kind: 'link' };
  }

  if (hostIs(url, 'vimeo.com')) {
    // The id is the one numeric segment, wherever it sits — a bare `/<id>`, the player's
    // `/video/<id>`, a channel's or a group's longer path.
    const segments = url.pathname.replace(/^\/+/, '').split('/').filter(Boolean);
    return segments.some((s) => VIMEO_ID.test(s)) ? { kind: 'video' } : { kind: 'link' };
  }

  if (isMapsHost(url)) {
    // Google's own embed string frames; every other map link becomes an anchor, which
    // reads to an author as "the map block is broken". The Map block is the answer, and
    // the check says so.
    return isEmbeddableMap(url)
      ? { kind: 'frame' }
      : { kind: 'link', degraded: 'map-not-embeddable' };
  }

  // Audio / podcast players (silicaui 0.50): Spotify, SoundCloud, Apple Music, Apple
  // Podcasts. An `<iframe>` player, like `video`, but named so the check can say so.
  if (isAudio(url)) return { kind: 'audio' };

  // Every other host: a link. That is the engine's documented fallback and the right one
  // — a site that refuses to be embedded would otherwise be a blank box.
  return { kind: 'link' };
}

/* ── The two frames sparx renders itself ──────────────────────────────────────── */

/** How tall a sparx-rendered frame stands relative to its width. sparx's own markup, so
 *  these are ordinary component classes rather than tenant authoring vocabulary — but
 *  they are LITERAL strings so the apps' `@source` scan of this package safelists them
 *  (`embed.test.ts` pins that they are classes Tailwind actually emits).
 *
 *  Four real options, unlike the engine's `ratio`, which accepts `video` and `square` and
 *  silently collapses everything else to widescreen. */
export const FRAME_RATIOS = [
  { value: 'classic', label: 'Classic (4:3)', className: 'aspect-4/3' },
  { value: 'wide', label: 'Wide', className: 'aspect-video' },
  { value: 'square', label: 'Square', className: 'aspect-square' },
  { value: 'tall', label: 'Tall (portrait)', className: 'aspect-3/4' },
] as const;

export type FrameRatio = (typeof FRAME_RATIOS)[number]['value'];

/** The ratio class for an author's choice. Reads an untyped `HostNode.props` bag, so a
 *  missing or stale value must still produce a box with a height. */
export function frameRatioClass(value: unknown): string {
  const found = FRAME_RATIOS.find((r) => r.value === value);
  return (found ?? FRAME_RATIOS[0]).className;
}

/**
 * Anything else the tenant has a link to — a booking calendar, an order form, a
 * reservation widget, a donation page.
 *
 * WHY THIS IS SPARX'S AND NOT THE ENGINE'S, since the same question was answered wrongly
 * once already. The engine's `Embed` frames a fixed set of recognised providers —
 * YouTube, Vimeo, Google's own `/maps/embed` string, and (since 0.50) the audio/podcast
 * players (Spotify, SoundCloud, Apple Music, Apple Podcasts). EVERYTHING else — Calendly,
 * OpenTable, Typeform, a donation page — renders as a plain anchor. That is a sound default
 * for an engine, and it is not a general embed: the previous sparx builder shipped one (the
 * `bx-*` Embed section, still in `apps/site`), so dropping it would be a capability the
 * platform used to have and lost.
 *
 * The safety story is different from the Video block's and worth being explicit about,
 * because this one frames a URL the author chose. Three things carry it: the scheme is
 * forced to **https** (an http frame inside an https page is blocked as mixed content
 * anyway, so allowing it would only produce a silently blank box), the frame is
 * sandboxed, and the target's own `X-Frame-Options` / `frame-ancestors` is the real gate
 * — a site that does not want to be embedded refuses, which is why a passthrough is not a
 * way to frame somebody else's login page.
 */
export function frameEmbedSrc(value: unknown): string | null {
  const url = asUrl(value);
  return url?.protocol === 'https:' ? url.toString() : null;
}

/** Why a general embed link cannot be framed. `use-video-block` is not a failure of the
 *  link — it is the author reaching for the wrong block. Framing a YouTube watch page would
 *  give them a blank box (YouTube refuses it), and raw-framing a Spotify/podcast share page
 *  the same (it refuses too), when the Video/media block recognises the provider and mints
 *  the real player. Covers both the `video` and the `audio` kinds for that reason. */
export type FrameEmbedProblem = 'empty' | 'insecure' | 'not-a-link' | 'use-video-block';

export function frameEmbedProblem(value: unknown): FrameEmbedProblem | null {
  if (typeof value !== 'string' || value.trim() === '') return 'empty';
  const kind = embedOutcome(value).kind;
  if (kind === 'video' || kind === 'audio') return 'use-video-block';
  if (frameEmbedSrc(value)) return null;
  return /^http:\/\//i.test(value.trim()) ? 'insecure' : 'not-a-link';
}

/** A zoom level Google accepts, clamped to the range that is actually useful: 1 is the
 *  whole planet and 21 is individual floor plans, and neither is a shop's location. */
function clampZoom(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.min(20, Math.max(3, Math.round(n)));
}

/** `@52.3702,4.8952,17z` → the pair plus the zoom, both optional. */
const MAP_AT = /@(-?\d+\.\d+),(-?\d+\.\d+)(?:,(\d+(?:\.\d+)?)z)?/;

/** The best locating string inside a pasted Google Maps URL. Coordinates first: a
 *  place NAME is ambiguous ("The Deli" is thousands of places) while `@lat,lng` is the
 *  exact spot the author was looking at when they copied the link. */
function mapQueryFromUrl(url: URL): { q: string; zoom: number | null } | null {
  const at = MAP_AT.exec(url.pathname) ?? MAP_AT.exec(url.hash);
  const zoom = at?.[3] ? clampZoom(at[3]) : null;
  if (at) return { q: `${at[1]},${at[2]}`, zoom };

  const explicit = url.searchParams.get('q') ?? url.searchParams.get('query');
  if (explicit) return { q: explicit, zoom };

  const ll = url.searchParams.get('ll');
  if (ll && /^-?\d+\.\d+,-?\d+\.\d+$/.test(ll)) return { q: ll, zoom };

  // `/maps/place/Some+Place+Name/…` or `/maps/search/…` with no coordinates — an older
  // or trimmed share link. The name is worth using; `+` is a space in this segment.
  const place = /\/maps\/(?:place|search)\/([^/@]+)/.exec(url.pathname)?.[1];
  if (place) return { q: decodeURIComponent(place).replace(/\+/g, ' '), zoom };

  return null;
}

/**
 * An address, a place name, or a pasted Google Maps link → a map frame URL that works.
 *
 * `output=embed` is the key-free map embed. The OFFICIAL Maps Embed API would want a
 * Google API key, which means a platform-level credential and a per-load bill on every
 * tenant's contact page; that is a spend decision rather than an implementation detail,
 * so the key-free form is what ships. If it ever stops working, the fix is this one
 * template — every map on the platform is built here.
 *
 * Takes a plain address, and that is the whole reason this exists rather than a stamped
 * `Embed`. "Find your shop on Google Maps, open the share menu, choose Embed a map, copy
 * the iframe code, take the src out of it" is not a thing to ask of someone who is trying
 * to put their address on their contact page. They type the address.
 */
export function mapEmbedSrc(value: unknown, zoom?: unknown): string | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const raw = value.trim();
  const url = asUrl(raw);

  let q = raw;
  let derivedZoom: number | null = null;
  if (url) {
    // A link that is not Google's is not a location. Without this, any pasted URL would
    // become a map "of" its own text.
    if (!isMapsHost(url)) return null;
    // A shortened link (`maps.app.goo.gl/…`) carries nothing but an opaque token —
    // resolving it needs a network round trip a parser cannot make. `mapEmbedProblem`
    // reports that specifically so the author is told to paste the full link.
    const found = mapQueryFromUrl(url);
    if (!found) return null;
    q = found.q;
    derivedZoom = found.zoom;
  }

  const params = new URLSearchParams({ q, output: 'embed' });
  const z = clampZoom(zoom) ?? derivedZoom;
  if (z !== null) params.set('z', String(z));
  return `https://www.google.com/maps?${params}`;
}

/** Why a map location cannot be framed. `shortened-link` is its own case because the
 *  fix is specific and the author would otherwise think their link was wrong. */
export type MapEmbedProblem = 'empty' | 'shortened-link' | 'no-location-in-link';

export function mapEmbedProblem(value: unknown, zoom?: unknown): MapEmbedProblem | null {
  if (mapEmbedSrc(value, zoom)) return null;
  if (typeof value !== 'string' || value.trim() === '') return 'empty';
  const url = asUrl(value.trim());
  if (url && (hostIs(url, 'goo.gl') || url.hostname.toLowerCase().startsWith('maps.app.')))
    return 'shortened-link';
  return 'no-location-in-link';
}
