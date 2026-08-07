// The check that catches an embed which will disappoint its author.
//
// Both blocks fail SILENTLY and in the author's blind spot, which is the whole reason
// this rule exists. An `Embed` with nothing in it renders an empty element — no error, no
// placeholder, just a gap — and one pointing at a channel page or a Google Maps link
// renders a plain anchor, which reads as a styling problem rather than as the engine's
// answer. The `site.map` core is silent by choice, because an empty bordered box on a
// shop's contact page is worse than an absence.
//
// THE OTHER HALF OF THIS FILE IS THE FALSE POSITIVES, and on the silicaui 0.49 upgrade
// they were the bigger risk. Seven shapes that could not play on 0.47 — Shorts,
// livestreams, playlists, Vimeo channel links, unlisted videos, start times — now play
// fine, and a check still warning about them would send authors to change links that were
// already correct. They are asserted SILENT below, by name.
//
// The surviving sentences have to name the actual fix; "invalid URL" is accurate and
// useless. This file pins that they stay distinct — the failure mode guarded against is
// somebody consolidating them into one polite, unactionable message.

import { describe, expect, it } from 'vitest';
import { HOST_KEYS } from '@sparx/silica-catalog';

import { lintSite } from './lint';
import type { LintablePage, SiteLintReport } from './types';

/** One page holding one block, plus a heading so `page-empty` does not fire and bury
 *  the finding under a louder one. */
function pageWith(node: unknown): LintablePage {
  return {
    id: 'p1',
    name: 'Contact',
    slug: '/contact',
    noindex: true,
    root: {
      kind: 'element',
      tag: 'section',
      children: [{ kind: 'element', tag: 'h1', children: ['Find us'] }, node],
    },
  } as LintablePage;
}

const embed = (props: Record<string, unknown>) => ({
  kind: 'component',
  component: 'Embed',
  class: 'w-full',
  props,
});

const map = (props: Record<string, unknown>) => ({
  kind: 'host',
  component: HOST_KEYS.siteMap,
  class: 'w-full',
  props,
});

const frame = (props: Record<string, unknown>) => ({
  kind: 'host',
  component: HOST_KEYS.siteEmbed,
  class: 'w-full',
  props,
});

function check(node: unknown): SiteLintReport {
  return lintSite({ pages: [pageWith(node)] });
}

function findings(node: unknown) {
  return check(node).findings.filter((f) => f.rule === 'embed-no-source');
}

describe('a block that will not do what its author expects is reported', () => {
  it.each([
    ['an empty embed', embed({ url: '', title: 'Video' })],
    ['a channel page', embed({ url: 'https://www.youtube.com/@somechannel' })],
    ['an ordinary map page', embed({ url: 'https://www.google.com/maps/place/A/@1.5,2.5,17z' })],
    ['a host that does not play here', embed({ url: 'https://dailymotion.com/video/x1' })],
    ['an empty map', map({ location: '' })],
    ['a shortened map link', map({ location: 'https://maps.app.goo.gl/abc' })],
    ['an empty embed', frame({ url: '' })],
    ['an insecure embed', frame({ url: 'http://example.com/widget' })],
    ['an embed that is not a link', frame({ url: 'nonsense' })],
    // A video link in the general block: the engine's providers refuse to be framed as
    // ordinary pages, so this would come out blank — the Video block is the answer.
    ['a video link in the embed block', frame({ url: 'https://youtu.be/dQw4w9WgXcQ' })],
  ])('%s', (_name, node) => {
    const found = findings(node);
    expect(found.length).toBe(1);
    expect(found[0]?.severity).toBe('warning');
  });

  it.each([
    // Every one of these was a FINDING on silicaui 0.47 and is silent now, which is the
    // half of an upgrade that is easy to miss: a check that keeps warning about a fixed
    // problem sends authors to change links that are already right.
    ['a video that plays', embed({ url: 'https://youtu.be/dQw4w9WgXcQ' })],
    ['a Short', embed({ url: 'https://www.youtube.com/shorts/dQw4w9WgXcQ' })],
    ['a livestream', embed({ url: 'https://www.youtube.com/live/dQw4w9WgXcQ' })],
    ['a playlist', embed({ url: 'https://www.youtube.com/playlist?list=PLtestList01' })],
    ['an unlisted Vimeo video', embed({ url: 'https://vimeo.com/123456789/abc123def4' })],
    ['a Vimeo channel video', embed({ url: 'https://vimeo.com/channels/staff/123456789' })],
    ['a start time', embed({ url: 'https://youtu.be/dQw4w9WgXcQ?t=90' })],
    ['the "Embed a map" string', embed({ url: 'https://www.google.com/maps/embed?pb=!1m18' })],
    ['a map with an address', map({ location: '123 Main St, Springfield' })],
    // The general block's headline use case: a booking calendar, which the ENGINE would
    // have rendered as a plain link. It is silent here because sparx frames it itself.
    ['a booking calendar', frame({ url: 'https://calendly.com/acme/30min' })],
  ])('%s is not reported', (_name, node) => {
    expect(findings(node)).toEqual([]);
  });
});

describe('each failure gets its own sentence', () => {
  /** One title per distinct way these two blocks let an author down. */
  const titles = [
    embed({ url: '' }),
    embed({ url: 'https://dailymotion.com/video/x1' }),
    embed({ url: 'https://www.google.com/maps/place/A/@1.5,2.5,17z' }),
    map({ location: '' }),
    map({ location: 'https://maps.app.goo.gl/abc' }),
    map({ location: 'https://www.google.com/maps/dir///' }),
    frame({ url: '' }),
    frame({ url: 'http://example.com/widget' }),
    frame({ url: 'nonsense' }),
    frame({ url: 'https://youtu.be/dQw4w9WgXcQ' }),
  ].map((node) => findings(node)[0]?.title);

  it('produces a finding for every case', () => {
    // Guard on the guard: an undefined here would make the uniqueness check below pass
    // while proving nothing.
    expect(titles.filter(Boolean).length).toBe(titles.length);
  });

  it('never says the same thing twice', () => {
    expect(new Set(titles).size).toBe(titles.length);
  });

  it('quotes what the author actually typed', () => {
    expect(findings(embed({ url: 'https://dailymotion.com/x' }))[0]?.evidence).toBe(
      'https://dailymotion.com/x'
    );
    // No evidence for an empty field: there is nothing to show, and a blank quote reads
    // as a bug in the check rather than as a blank field.
    expect(findings(embed({ url: '' }))[0]?.evidence).toBeUndefined();
  });
});

describe('the wording stays usable by someone who is not technical', () => {
  it('avoids the words a business owner would have to look up', () => {
    // The audience is a business owner, not a developer. "iframe", "embed code", "URI",
    // "parse" and "CORS" all fail that; naming YouTube, Vimeo and Google is fine, and so
    // is telling someone to copy an address.
    const jargon = /\biframes?\b|\bparse|\bembed code\b|\bURI\b|\bCORS\b|X-Frame|\bDOM\b/i;
    for (const node of [
      embed({ url: '' }),
      embed({ url: 'https://www.youtube.com/shorts/dQw4w9WgXcQ' }),
      embed({ url: 'https://www.google.com/maps/place/A/@1.5,2.5,17z' }),
      map({ location: '' }),
      frame({ url: '' }),
      frame({ url: 'http://example.com/widget' }),
      frame({ url: 'https://youtu.be/dQw4w9WgXcQ' }),
    ]) {
      for (const found of findings(node)) {
        expect(`${found.title} ${found.detail}`, found.title).not.toMatch(jargon);
      }
    }
  });
});
