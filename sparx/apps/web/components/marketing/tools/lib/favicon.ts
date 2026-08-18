/**
 * Favicon generation pipeline — the part that makes this tool not suck.
 *
 * Online generators ship a single 16×16 .ico and call it done. We render the
 * full real-world set from one source image, entirely on the client:
 *   - a multi-resolution PNG-in-ICO (16/32/48)
 *   - standalone 16/32/48 PNGs
 *   - apple-touch-icon (180, forced opaque — iOS shows black behind alpha)
 *   - PWA icons (192/512)
 *   - a maskable icon (512, opaque, extra safe-zone padding for Android masks)
 *   - site.webmanifest
 *   - copy-paste <head> markup AND a Next.js App Router variant
 */
import { renderIconCanvas, canvasToPngBytes } from './canvas';
import { createIco } from './ico';

export interface FaviconOptions {
  /** Background fill for alpha-friendly icons; null = transparent. */
  background: string | null;
  /** Inset fraction (0–0.4). */
  padding: number;
  /** Corner-radius fraction for non-opaque icons (0–0.5). */
  radius: number;
  /** PWA manifest theme_color (browser UI tint). */
  themeColor: string;
  /** PWA manifest background_color (splash). */
  backgroundColor: string;
  appName: string;
  appShortName: string;
}

export interface GeneratedAsset {
  name: string;
  size: number;
  label: string;
  kind: 'ico' | 'png';
  bytes: Uint8Array;
  blob: Blob;
}

export interface FaviconResult {
  assets: GeneratedAsset[];
  manifest: string;
  htmlSnippet: string;
  nextManifestSnippet: string;
}

interface SizeSpec {
  name: string;
  size: number;
  label: string;
  /** Force an opaque background (apple-touch, maskable). */
  opaque: boolean;
  /** Extra padding fraction (maskable safe zone). */
  extraPad?: number;
}

const SPECS: SizeSpec[] = [
  { name: 'favicon-16x16.png', size: 16, label: '16×16', opaque: false },
  { name: 'favicon-32x32.png', size: 32, label: '32×32', opaque: false },
  { name: 'favicon-48x48.png', size: 48, label: '48×48', opaque: false },
  { name: 'apple-touch-icon.png', size: 180, label: 'Apple touch · 180', opaque: true },
  { name: 'icon-192.png', size: 192, label: 'PWA · 192', opaque: false },
  { name: 'icon-512.png', size: 512, label: 'PWA · 512', opaque: false },
  { name: 'maskable-512.png', size: 512, label: 'Maskable · 512', opaque: true, extraPad: 0.12 },
];

const ICO_FROM = new Set(['favicon-16x16.png', 'favicon-32x32.png', 'favicon-48x48.png']);

/** Generate the full favicon package from a decoded source image. */
export async function generateFavicons(
  img: HTMLImageElement,
  opts: FaviconOptions
): Promise<FaviconResult> {
  const assets: GeneratedAsset[] = [];
  const icoImages: { size: number; png: Uint8Array }[] = [];

  for (const spec of SPECS) {
    const background = spec.opaque
      ? (opts.background ?? opts.backgroundColor ?? '#FFFFFF')
      : opts.background;
    const canvas = renderIconCanvas(img, {
      size: spec.size,
      background,
      padding: opts.padding + (spec.extraPad ?? 0),
      radius: spec.opaque ? 0 : opts.radius,
    });
    const bytes = await canvasToPngBytes(canvas);
    assets.push({
      name: spec.name,
      size: spec.size,
      label: spec.label,
      kind: 'png',
      bytes,
      blob: new Blob([bytes] as BlobPart[], { type: 'image/png' }),
    });
    if (ICO_FROM.has(spec.name)) icoImages.push({ size: spec.size, png: bytes });
  }

  const icoBlob = createIco(icoImages);
  const icoBytes = new Uint8Array(await icoBlob.arrayBuffer());
  assets.unshift({
    name: 'favicon.ico',
    size: 48,
    label: 'Multi-res .ico (16/32/48)',
    kind: 'ico',
    bytes: icoBytes,
    blob: icoBlob,
  });

  return {
    assets,
    manifest: buildManifest(opts),
    htmlSnippet: buildHtmlSnippet(opts),
    nextManifestSnippet: buildNextManifest(opts),
  };
}

function buildManifest(opts: FaviconOptions): string {
  return `${JSON.stringify(
    {
      name: opts.appName,
      short_name: opts.appShortName || opts.appName,
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
      theme_color: opts.themeColor,
      background_color: opts.backgroundColor,
      display: 'standalone',
    },
    null,
    2
  )}\n`;
}

function buildHtmlSnippet(opts: FaviconOptions): string {
  return [
    '<!-- Place these in your <head>. Files go in your site root. -->',
    '<link rel="icon" href="/favicon.ico" sizes="any">',
    '<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">',
    '<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">',
    '<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">',
    '<link rel="manifest" href="/site.webmanifest">',
    `<meta name="theme-color" content="${opts.themeColor}">`,
  ].join('\n');
}

function buildNextManifest(opts: FaviconOptions): string {
  return [
    '// Next.js App Router — drop the icons into app/ using the file conventions:',
    '//   app/favicon.ico        (Next serves it automatically)',
    '//   app/icon.png           (32×32 — rename favicon-32x32.png)',
    '//   app/apple-icon.png     (180×180 — rename apple-touch-icon.png)',
    '//   public/icon-192.png, public/icon-512.png, public/maskable-512.png',
    '// Then add app/manifest.ts:',
    '',
    "import type { MetadataRoute } from 'next';",
    '',
    'export default function manifest(): MetadataRoute.Manifest {',
    '  return {',
    `    name: ${JSON.stringify(opts.appName)},`,
    `    short_name: ${JSON.stringify(opts.appShortName || opts.appName)},`,
    '    icons: [',
    "      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },",
    "      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },",
    "      { src: '/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },",
    '    ],',
    `    theme_color: ${JSON.stringify(opts.themeColor)},`,
    `    background_color: ${JSON.stringify(opts.backgroundColor)},`,
    "    display: 'standalone',",
    '  };',
    '}',
  ].join('\n');
}
