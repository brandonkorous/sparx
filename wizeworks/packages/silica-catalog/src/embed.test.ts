// Two things, and the first is the important one.
//
// `embedOutcome` is a MODEL of someone else's behaviour — what silicaui's `Embed` will
// do with a pasted link — and a model of someone else's behaviour drifts. So the first
// block asserts it against the REAL renderer for every case, rather than against what
// the model's author believed on the day. If silicaui changes what it accepts, this
// fails, instead of the pre-publish check quietly telling authors the wrong thing.
//
// The second block is `mapEmbedSrc`, which is sparx's own and is tested normally — with
// the shapes real people arrive with, because tolerating those is its entire job: the
// address bar, a place someone was looking at when they hit copy, a shortened link, and
// an address typed straight in.

import { describe, expect, it } from 'vitest';

import { embedOutcome, mapEmbedProblem, mapEmbedSrc, frameRatioClass, FRAME_RATIOS } from './embed';
import { renderSilicaBody } from './render';

/** One `Embed` component, rendered exactly as a published page would render it. */
function render(url: string): string {
  return renderSilicaBody(
    {
      kind: 'component',
      component: 'Embed',
      class: '',
      props: { url, title: 'Test' },
    } as never,
    {}
  );
}

/** What the engine ACTUALLY did, read back off its markup. `frame` covers a map or any
 *  passthrough; the caller compares against the model's own kind. */
function actual(url: string): { framed: boolean; src: string | null; link: boolean } {
  const html = render(url);
  return {
    framed: html.includes('<iframe'),
    src: /<iframe[^>]*\ssrc="([^"]*)"/.exec(html)?.[1]?.replaceAll('&amp;', '&') ?? null,
    link: html.includes('<a '),
  };
}

/**
 * Every link shape worth pinning, with what the model says about it.
 *
 * THIS TABLE HAS ALREADY EARNED ITS KEEP, which is worth knowing before trimming it. On
 * silicaui 0.47 the engine could not play a Short, a livestream, a playlist, a Vimeo
 * channel link, or an unlisted video (it dropped the private hash, so the video played
 * for the signed-in author and errored for every visitor), and it dropped `?t=` start
 * times. 0.49 fixed all of them. Eight rows here went red on the upgrade — which is the
 * only reason the model was corrected that day rather than months later via a tenant
 * whose video would not play.
 */
const CASES: { url: string; kind: string; degraded?: string; note: string }[] = [
  // YouTube, in every shape their own UI hands out.
  { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', kind: 'video', note: 'the address bar' },
  { url: 'https://youtu.be/dQw4w9WgXcQ', kind: 'video', note: 'the Share button' },
  { url: 'https://m.youtube.com/watch?v=dQw4w9WgXcQ', kind: 'video', note: 'the mobile site' },
  { url: 'https://www.youtube.com/shorts/dQw4w9WgXcQ', kind: 'video', note: 'a Short' },
  { url: 'https://www.youtube.com/live/dQw4w9WgXcQ', kind: 'video', note: 'a livestream' },
  { url: 'https://www.youtube.com/v/dQw4w9WgXcQ', kind: 'video', note: 'an old-style link' },
  { url: 'https://youtu.be/dQw4w9WgXcQ?t=90', kind: 'video', note: 'a start time' },
  {
    url: 'https://www.youtube.com/playlist?list=PLtestList01',
    kind: 'video',
    note: 'a playlist',
  },
  {
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLtestList01',
    kind: 'video',
    note: 'a video inside a playlist',
  },

  // Vimeo, including the unlisted form whose hash is the difference between a video
  // that plays for visitors and one that plays only for its signed-in owner.
  { url: 'https://vimeo.com/123456789', kind: 'video', note: 'a Vimeo page' },
  { url: 'https://player.vimeo.com/video/123456789', kind: 'video', note: 'the Vimeo player' },
  {
    url: 'https://vimeo.com/123456789/abc123def4',
    kind: 'video',
    note: 'an unlisted Vimeo video',
  },
  {
    url: 'https://vimeo.com/channels/staffpicks/123456789',
    kind: 'video',
    note: 'a Vimeo channel video',
  },
  {
    url: 'https://vimeo.com/groups/somegroup/videos/123456789',
    kind: 'video',
    note: 'a Vimeo group video',
  },

  // Named a provider, but not one video — the author pasted the wrong page.
  { url: 'https://www.youtube.com/@somechannel', kind: 'link', note: 'a channel page' },
  { url: 'https://vimeo.com/somechannel', kind: 'link', note: 'a Vimeo channel page' },
  { url: 'https://www.youtube.com/watch?v=SHORT', kind: 'link', note: 'an id of the wrong length' },

  // Not a provider at all: the engine links it, which is the right answer.
  { url: 'https://dailymotion.com/video/x123', kind: 'link', note: 'a host we do not frame' },
  { url: 'https://calendly.com/acme/30min', kind: 'link', note: 'a booking calendar' },

  // Maps. Exactly ONE form frames — the string behind Google's "Embed a map" button.
  // Every other map link becomes an anchor, including the `output=embed` form that used
  // to work on 0.47.
  {
    url: 'https://www.google.com/maps/embed?pb=!1m18',
    kind: 'frame',
    note: 'the "Embed a map" string',
  },
  {
    url: 'https://www.google.com/maps?q=London&output=embed',
    kind: 'link',
    degraded: 'map-not-embeddable',
    note: 'the output=embed form, which 0.49 stopped framing',
  },
  {
    url: 'https://www.google.com/maps/place/The+Deli/@52.3702,4.8952,17z',
    kind: 'link',
    degraded: 'map-not-embeddable',
    note: 'an ordinary map page',
  },
  {
    url: 'https://maps.google.com/?q=London',
    kind: 'link',
    degraded: 'map-not-embeddable',
    note: 'the maps subdomain',
  },

  // Audio / podcast players — added on silicaui 0.50, where these stopped being anchors.
  {
    url: 'https://open.spotify.com/track/6rqhFgbbKwnb9MLmUQDhG6',
    kind: 'audio',
    note: 'a Spotify track',
  },
  {
    url: 'https://open.spotify.com/album/1DFixLWuPkv3KT3TnV35m3',
    kind: 'audio',
    note: 'a Spotify album',
  },
  {
    url: 'https://open.spotify.com/episode/512ojhOuo1ktJprKbVcKyQ',
    kind: 'audio',
    note: 'a Spotify podcast episode',
  },
  { url: 'https://soundcloud.com/artist/track-name', kind: 'audio', note: 'a SoundCloud track' },
  {
    url: 'https://music.apple.com/us/album/album-name/1441164426',
    kind: 'audio',
    note: 'an Apple Music album',
  },
  {
    url: 'https://podcasts.apple.com/us/podcast/name/id1200361736',
    kind: 'audio',
    note: 'an Apple Podcasts show',
  },
  {
    url: 'https://open.spotify.com',
    kind: 'link',
    note: 'a bare provider host with nothing to play',
  },

  // Nothing typed yet.
  { url: '', kind: 'empty', note: 'an empty block' },
];

describe('embedOutcome matches what silicaui actually renders', () => {
  it('has cases covering every outcome the model can return', () => {
    // Guard on the guard: an outcome with no case would be asserted by nothing, which
    // is how a model starts lying about the one shape nobody listed.
    expect(new Set(CASES.map((c) => c.kind))).toEqual(
      new Set(['video', 'audio', 'frame', 'link', 'empty'])
    );
    expect(new Set(CASES.filter((c) => c.degraded).map((c) => c.degraded))).toEqual(
      new Set(['map-not-embeddable'])
    );
  });

  it.each(CASES)('$note — $url', ({ url, kind, degraded }) => {
    const model = embedOutcome(url);
    expect(model.kind, 'model kind').toBe(kind);
    expect(model.degraded ?? null, 'model degradation').toBe(degraded ?? null);

    const real = actual(url);
    // `video`, `audio` and `frame` must actually produce an iframe; `link`/`empty` must not.
    expect(real.framed, `${url}: engine framed?`).toBe(
      kind === 'video' || kind === 'audio' || kind === 'frame'
    );
    if (kind === 'link') expect(real.link, `${url}: engine linked?`).toBe(true);
  });

  it('keeps the two parts of a link that are invisible when lost', () => {
    // Both were dropped on 0.47 and both fail in a way the author cannot see: the video
    // starts from the top instead of where they set it, and an unlisted video plays for
    // them (signed in) while every visitor gets an error. Asserting only "it framed"
    // would pass in both cases.
    expect(actual('https://youtu.be/dQw4w9WgXcQ?t=90').src).toContain('start=90');
    expect(actual('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1m30s').src).toContain('start=90');
    expect(actual('https://vimeo.com/123456789/abc123def4').src).toContain('h=abc123def4');
  });

  it('sends nobody to the ad-cookie domain', () => {
    // `youtube-nocookie.com` is a privacy default worth pinning: it is the difference
    // between a tenant's page setting third-party advertising cookies on every visitor
    // and not, and a regression here would be invisible.
    expect(actual('https://www.youtube.com/watch?v=dQw4w9WgXcQ').src).toContain(
      'youtube-nocookie.com'
    );
  });

  it('shows a visitor nothing at all for an empty block', () => {
    // 0.47 drew an authoring prompt here — "Add a YouTube, Vimeo, or Google Maps URL" —
    // on the published page. Now it is an empty element, which is the right call and is
    // also why the pre-publish check has to report it: nothing on the live site says the
    // block is unfinished.
    const html = render('');
    expect(html).not.toContain('<iframe');
    expect(html.toLowerCase()).not.toContain('add a');
  });

  it('is not fooled by a lookalike domain', () => {
    // `endsWith('youtube.com')` on a bare string would accept these.
    expect(embedOutcome('https://notyoutube.com/watch?v=dQw4w9WgXcQ').kind).toBe('link');
    expect(embedOutcome('https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ').kind).toBe('link');
  });

  it('refuses a scheme nobody pasted from a video site', () => {
    for (const value of ['javascript:alert(1)', 'data:text/html,<script>x</script>', 'not a url'])
      expect(embedOutcome(value).kind).toBe('empty');
    // `HostNode.props` is untyped, so a number or an object genuinely reaches here.
    for (const value of [null, undefined, 42, {}, []])
      expect(embedOutcome(value).kind).toBe('empty');
  });
});

describe('the map sparx builds itself', () => {
  it('takes a plain address, which is what a shop owner types first', () => {
    expect(mapEmbedSrc('123 Main St, Springfield, IL')).toBe(
      'https://www.google.com/maps?q=123+Main+St%2C+Springfield%2C+IL&output=embed'
    );
  });

  it('encodes the address rather than concatenating it', () => {
    // An ampersand in a business name would otherwise start a new query parameter.
    const out = mapEmbedSrc('Bob & Sons Hardware, Leeds') ?? '';
    expect(out).toContain('Bob+%26+Sons+Hardware');
    expect(out.split('&').filter((p) => p.startsWith('output=')).length).toBe(1);
  });

  it('makes a working map out of the link the engine frames but the browser refuses', () => {
    // The exact case `embedOutcome` reports as `map-not-embeddable`. This is the whole
    // justification for the `site.map` core existing beside the engine's `Embed`.
    const page = 'https://www.google.com/maps/place/The+Deli/@52.3702,4.8952,17z/data=!x';
    expect(embedOutcome(page).degraded).toBe('map-not-embeddable');
    expect(mapEmbedSrc(page)).toBe(
      'https://www.google.com/maps?q=52.3702%2C4.8952&output=embed&z=17'
    );
  });

  it('prefers coordinates over the place name', () => {
    // A name is ambiguous ("The Deli" is thousands of places); `@lat,lng` is the exact
    // spot the author was looking at.
    expect(mapEmbedSrc('https://www.google.com/maps/place/The+Deli/@52.3702,4.8952,17z')).toContain(
      'q=52.3702%2C4.8952'
    );
  });

  it('falls back to the place name when a link carries no coordinates', () => {
    expect(mapEmbedSrc('https://www.google.com/maps/place/Bob+and+Sons+Hardware')).toBe(
      'https://www.google.com/maps?q=Bob+and+Sons+Hardware&output=embed'
    );
    expect(mapEmbedSrc('https://www.google.com/maps/search/Bob+and+Sons')).toContain(
      'q=Bob+and+Sons'
    );
  });

  it("uses the author's zoom over the link's, and clamps both", () => {
    expect(mapEmbedSrc('https://www.google.com/maps/@52.3702,4.8952,17z', 12)).toContain('&z=12');
    expect(mapEmbedSrc('London', 0)).toContain('&z=3');
    expect(mapEmbedSrc('London', 99)).toContain('&z=20');
  });

  it('tells a shortened link apart from a bad one', () => {
    // A short link hides the place entirely and cannot be resolved without a network
    // round trip, so the author gets a specific instruction rather than "invalid".
    expect(mapEmbedSrc('https://maps.app.goo.gl/abc123')).toBeNull();
    expect(mapEmbedProblem('https://maps.app.goo.gl/abc123')).toBe('shortened-link');
    expect(mapEmbedProblem('')).toBe('empty');
    expect(mapEmbedProblem('123 Main St')).toBeNull();
  });

  it('refuses a non-Google link that happens to be a URL', () => {
    // Otherwise any pasted link would become a map "of" its own text.
    expect(mapEmbedSrc('https://example.com/where-we-are')).toBeNull();
  });

  it('always produces a ratio class with a height in it', () => {
    // Reads an untyped props bag, so a missing or stale value must not collapse the
    // frame to nothing. Every declared class is one Tailwind emits (`aspect-4/3` and
    // `aspect-3/4` are v4 fraction utilities, not arbitrary values).
    for (const r of FRAME_RATIOS) expect(frameRatioClass(r.value)).toBe(r.className);
    expect(frameRatioClass(undefined)).toBe('aspect-4/3');
    expect(frameRatioClass('16:9')).toBe('aspect-4/3');
  });
});
