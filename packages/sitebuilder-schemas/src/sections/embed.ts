import { z } from 'zod';
import type { SectionField } from '../fields';

// Embed section — drops a third-party iframe (a map, a video, a booking widget,
// a form, a calendar, …) into the page from a single pasted URL.
//
// The platform deliberately does NOT build maps / video players / booking
// widgets natively: a merchant brings their own and embeds it. `resolveEmbed()`
// normalizes the common providers (Google Maps, YouTube, Vimeo) to their iframe
// `src` form and passes any other https URL straight through to a sandboxed
// iframe — the browser still enforces the target's X-Frame-Options / CSP, so an
// un-embeddable URL simply renders blank rather than being a security hole.

export const EmbedConfig = z.object({
  // The pasted URL: a provider share/page link OR a ready-made iframe `src`.
  url: z.string().max(2048).default(''),
  heading: z.string().max(160).default(''),
  caption: z.string().max(300).default(''),
  aspect: z.enum(['16:9', '4:3', '3:2', '1:1', '21:9']).default('16:9'),
  width: z.enum(['prose', 'wide', 'full']).default('wide'),
});
export type EmbedConfig = z.infer<typeof EmbedConfig>;

export const embedFields: SectionField[] = [
  {
    key: 'url',
    label: 'Embed URL',
    type: 'url',
    placeholder: 'https://www.google.com/maps/embed?pb=…',
    help: 'Paste a Google Maps “Embed a map” link, a YouTube or Vimeo video URL, or any embeddable URL.',
  },
  { key: 'heading', label: 'Heading', type: 'text', help: 'Optional — shown above the embed.' },
  { key: 'caption', label: 'Caption', type: 'text', help: 'Optional — shown below the embed.' },
  {
    key: 'aspect',
    label: 'Aspect ratio',
    type: 'select',
    options: [
      { label: 'Widescreen 16:9 (video)', value: '16:9' },
      { label: 'Standard 4:3', value: '4:3' },
      { label: 'Photo 3:2', value: '3:2' },
      { label: 'Square 1:1', value: '1:1' },
      { label: 'Cinematic 21:9', value: '21:9' },
    ],
  },
  {
    key: 'width',
    label: 'Width',
    type: 'select',
    options: [
      { label: 'Readable', value: 'prose' },
      { label: 'Wide', value: 'wide' },
      { label: 'Full width', value: 'full' },
    ],
  },
];

// Provider URL patterns — module-level so each is compiled once. None are
// global, so exec() carries no lastIndex state between calls.
const VIMEO_PATH_RE = /\/(\d+)/;
const YT_PATH_RE = /\/(?:embed|shorts|live|v)\/([^/?#]+)/;
const MAPS_PLACE_RE = /\/maps\/(?:place|search)\/([^/@]+)/;
const MAPS_LATLNG_RE = /@(-?\d+\.\d+),(-?\d+\.\d+)/;

export type EmbedProvider = 'google-maps' | 'youtube' | 'vimeo' | 'generic';

export interface ResolvedEmbed {
  /** The iframe `src` to render. */
  src: string;
  /** Accessible title for the iframe. */
  title: string;
  provider: EmbedProvider;
  allowFullScreen: boolean;
}

/**
 * Turn a pasted URL into an iframe `src`. Returns null for an empty / non-http
 * URL. Known providers are normalized to their embed form; anything else is
 * passed through (rendered sandboxed). Pure + side-effect free so the editor
 * preview and the storefront can share it, and it's unit-testable.
 */
export function resolveEmbed(raw: string | null | undefined): ResolvedEmbed | null {
  const input = (raw ?? '').trim();
  if (!input) return null;

  let u: URL;
  try {
    u = new URL(input);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;

  const host = u.hostname.replace(/^www\./, '').toLowerCase();

  // ── YouTube ──────────────────────────────────────────────────
  if (
    host === 'youtu.be' ||
    host.endsWith('youtube.com') ||
    host.endsWith('youtube-nocookie.com')
  ) {
    const id = youtubeId(u);
    if (id) {
      return {
        src: `https://www.youtube.com/embed/${id}`,
        title: 'YouTube video',
        provider: 'youtube',
        allowFullScreen: true,
      };
    }
  }

  // ── Vimeo ────────────────────────────────────────────────────
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    if (host === 'player.vimeo.com') {
      return { src: u.toString(), title: 'Vimeo video', provider: 'vimeo', allowFullScreen: true };
    }
    const id = VIMEO_PATH_RE.exec(u.pathname)?.[1];
    if (id) {
      return {
        src: `https://player.vimeo.com/video/${id}`,
        title: 'Vimeo video',
        provider: 'vimeo',
        allowFullScreen: true,
      };
    }
  }

  // ── Google Maps ──────────────────────────────────────────────
  const isMaps =
    host === 'maps.google.com' ||
    host === 'maps.app.goo.gl' ||
    ((host === 'google.com' || host.endsWith('.google.com')) && u.pathname.startsWith('/maps')) ||
    (host === 'goo.gl' && u.pathname.startsWith('/maps'));
  if (isMaps) {
    const src = googleMapsEmbed(u);
    if (src) return { src, title: 'Map', provider: 'google-maps', allowFullScreen: true };
  }

  // ── Generic ──────────────────────────────────────────────────
  // Render any other https URL in a sandboxed iframe. The merchant is
  // responsible for pasting an embeddable URL; the browser enforces the rest.
  return {
    src: u.toString(),
    title: 'Embedded content',
    provider: 'generic',
    allowFullScreen: true,
  };
}

function youtubeId(u: URL): string | null {
  if (u.hostname.replace(/^www\./, '').toLowerCase() === 'youtu.be') {
    const id = u.pathname.slice(1).split('/')[0] ?? '';
    return id.length > 0 ? id : null;
  }
  const v = u.searchParams.get('v');
  if (v) return v;
  return YT_PATH_RE.exec(u.pathname)?.[1] ?? null;
}

function googleMapsEmbed(u: URL): string | null {
  // Already an embeddable map iframe `src` (the "Embed a map" share copies this).
  if (u.pathname.startsWith('/maps/embed')) return u.toString();
  // A classic keyless embed link.
  if (u.searchParams.get('output') === 'embed') return u.toString();
  // Otherwise derive a query and build a keyless classic embed.
  const q =
    u.searchParams.get('q') ??
    u.searchParams.get('query') ??
    placeFromPath(u.pathname) ??
    atLatLng(u.pathname);
  if (q) return `https://maps.google.com/maps?q=${encodeURIComponent(q)}&z=14&output=embed`;
  return null;
}

function placeFromPath(pathname: string): string | null {
  const seg = MAPS_PLACE_RE.exec(pathname)?.[1];
  if (!seg) return null;
  try {
    return decodeURIComponent(seg.replace(/\+/g, ' '));
  } catch {
    return seg;
  }
}

function atLatLng(pathname: string): string | null {
  const m = MAPS_LATLNG_RE.exec(pathname);
  if (!m) return null;
  const lat = m[1];
  const lng = m[2];
  return lat && lng ? `${lat},${lng}` : null;
}
