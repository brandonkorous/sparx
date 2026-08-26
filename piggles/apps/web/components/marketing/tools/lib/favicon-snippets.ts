/** The text that ships alongside the images: manifest, head markup, and the
 *  plain-English README that explains where each file goes. */

import type { FaviconFile, FaviconOptions } from './favicon-types';

const escapeJson = (value: string): string => JSON.stringify(value).slice(1, -1);

export const manifestJson = (opts: FaviconOptions): string => `{
  "name": "${escapeJson(opts.appName)}",
  "short_name": "${escapeJson(opts.appName.slice(0, 12))}",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ],
  "theme_color": "${escapeJson(opts.themeColor)}",
  "background_color": "${escapeJson(opts.background)}",
  "display": "standalone"
}
`;

export const headHtml = (opts: FaviconOptions): string =>
  `<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon-96x96.png" type="image/png" sizes="96x96">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="${opts.themeColor}">`;

/** The App Router reads icons from the file system by NAME, so pasting the
 *  markup above as well produces duplicate tags. Saying which file goes where is
 *  more useful than handing over markup the framework writes itself. */
export const nextjsNote = (opts: FaviconOptions): string =>
  `// Next.js App Router picks these up automatically — no <link> tags needed.
// Put the files in your app/ directory with these names:
//
//   app/favicon.ico
//   app/icon.png              ← rename icon-512.png
//   app/apple-icon.png        ← rename apple-touch-icon.png
//
// Then keep the manifest and theme color in your root layout:

export const metadata = {
  manifest: '/site.webmanifest',
  themeColor: '${opts.themeColor}',
};`;

function backdropNotes(opts: FaviconOptions): string[] {
  if (opts.fillBackground) {
    return [
      `  ${opts.background.toUpperCase()} is filled in behind your logo on every icon in this`,
      '  set, exactly as you chose it. Nothing is see-through anywhere.',
    ];
  }
  return [
    '  The tab and Android icons are see-through behind your logo, so they sit',
    "  on whatever color the reader's browser is using — white for some people,",
    '  near-black for others. A dark logo is hard to see on a dark tab, and a',
    '  pale one is hard to see on a light tab; that is the reason to put a',
    '  background on a favicon at all.',
    '',
    `  The home-screen icons are filled with ${opts.background.toUpperCase()}, because iPhones turn`,
    '  see-through pixels black.',
    '',
    '  If you want that solid color on all of them, go back and change "Behind',
    '  your logo" to a solid color. Nothing was erased from your picture — this',
    '  tool never removes a background.',
  ];
}

export const readmeText = (files: FaviconFile[], opts: FaviconOptions): string =>
  [
    'Your favicon set',
    '================',
    '',
    'Put every file in this archive in the ROOT folder of your website —',
    'the same place as your home page — and paste the contents of',
    'paste-into-your-head.html into the <head> of every page.',
    '',
    'What each one is for:',
    '',
    ...files.map((f) => `  ${f.name.padEnd(26)} ${f.note}`),
    '  site.webmanifest           Tells phones the name and colors to use when somebody installs your site.',
    '',
    'What is behind your logo:',
    '',
    ...backdropNotes(opts),
    '',
    'A note on caching: browsers hold on to favicons stubbornly. If you are',
    'replacing an old one and it looks unchanged, try a private window before',
    'concluding something went wrong.',
    '',
    'Made with the free favicon maker at meetpiggles.com/tools/favicon',
  ].join('\n');
