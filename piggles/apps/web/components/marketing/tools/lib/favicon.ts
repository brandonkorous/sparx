import { canvasToBlob, drawSquare, type LoadedImage } from './canvas';
import { buildIco } from './ico';
import { ZipBuilder } from './zip';

/**
 * Turning one picture into the set a real website needs.
 *
 * ── WHY THERE ARE SO MANY ───────────────────────────────────────────────────
 *
 * Each of these exists because some platform asks for it and falls back badly
 * when it is missing. The .ico covers browser tabs and the requests browsers
 * make for /favicon.ico whether you linked to it or not. The Apple touch icon is
 * what iOS puts on a home screen, and it must be opaque — iOS renders
 * transparency as black, so a logo with a see-through background becomes a logo
 * on a black tile. The 192 and 512 are what Android and desktop browsers read
 * from the manifest. The maskable one is Android again, cropping to whatever
 * shape the launcher likes, which is why it is drawn smaller inside its square.
 *
 * The set is deliberately not longer than this. Generators that emit forty files
 * are producing icons for Windows 8 tiles and old Safari pinned tabs, which
 * nothing has asked for in years, and every extra file is another line of markup
 * somebody has to paste and maintain.
 */

export interface FaviconOptions {
  /** Filled behind the Apple touch icon and the maskable icon, both of which
   *  must be opaque. Ignored for the transparent ones. */
  background: string;
  /** Used in the web manifest. */
  appName: string;
  /** The browser's UI colour when the site is installed. */
  themeColour: string;
}

export interface FaviconOutput {
  files: { name: string; blob: Blob; size: number; note: string }[];
  manifest: string;
  html: string;
  nextjs: string;
  zip: () => Promise<Blob>;
}

const escapeJson = (value: string): string => JSON.stringify(value).slice(1, -1);

export async function buildFaviconSet(
  image: LoadedImage,
  opts: FaviconOptions
): Promise<FaviconOutput> {
  const png = async (size: number, background?: string, padding?: number) =>
    canvasToBlob(drawSquare(image, { size, background, padding, fit: 'contain' }));

  // The .ico carries three sizes in one file. 16 is the tab, 32 is the tab on a
  // high-resolution screen, 48 is the Windows taskbar and some bookmark views.
  const icoSizes = [16, 32, 48];
  const icoEntries = await Promise.all(
    icoSizes.map(async (size) => ({
      size,
      png: await (await png(size)).arrayBuffer(),
    }))
  );

  const files: FaviconOutput['files'] = [
    {
      name: 'favicon.ico',
      blob: buildIco(icoEntries),
      size: 48,
      note: 'The browser tab, and the file browsers ask for whether you link to it or not.',
    },
    {
      name: 'favicon-96x96.png',
      blob: await png(96),
      size: 96,
      note: 'Bookmarks and shortcut tiles on desktop browsers.',
    },
    {
      // Opaque, always. This is the one that goes black otherwise.
      name: 'apple-touch-icon.png',
      blob: await png(180, opts.background),
      size: 180,
      note: 'What an iPhone puts on the home screen. Opaque, because iOS turns transparency black.',
    },
    {
      name: 'icon-192.png',
      blob: await png(192),
      size: 192,
      note: 'Android home screens and the install prompt.',
    },
    {
      name: 'icon-512.png',
      blob: await png(512),
      size: 512,
      note: 'The large icon, used on splash screens and in app listings.',
    },
    {
      // 10% inset each side leaves the logo inside the circle Android crops to.
      name: 'icon-maskable-512.png',
      blob: await png(512, opts.background, 0.1),
      size: 512,
      note: 'Android crops icons to whatever shape it likes, so this one is drawn smaller with room around it.',
    },
  ];

  const manifest = `{
  "name": "${escapeJson(opts.appName)}",
  "short_name": "${escapeJson(opts.appName.slice(0, 12))}",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ],
  "theme_color": "${escapeJson(opts.themeColour)}",
  "background_color": "${escapeJson(opts.background)}",
  "display": "standalone"
}
`;

  const html = `<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon-96x96.png" type="image/png" sizes="96x96">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="${opts.themeColour}">`;

  // The App Router reads icons from the file system by NAME, so most of the
  // markup above is unnecessary there — and pasting it in as well produces
  // duplicate tags. Saying which files to put where is more useful than handing
  // over markup that framework would have written itself.
  const nextjs = `// Next.js App Router picks these up automatically — no <link> tags needed.
// Put the files in your app/ directory with these names:
//
//   app/favicon.ico
//   app/icon.png              ← rename icon-512.png
//   app/apple-icon.png        ← rename apple-touch-icon.png
//
// Then keep the manifest and theme colour in your root layout:

export const metadata = {
  manifest: '/site.webmanifest',
  themeColor: '${opts.themeColour}',
};`;

  const zip = async () => {
    const builder = new ZipBuilder();
    for (const file of files) builder.add(file.name, await file.blob.arrayBuffer());
    builder.add('site.webmanifest', manifest);
    builder.add(
      'paste-into-your-head.html',
      `<!-- Put these inside the <head> of every page. -->\n${html}\n`
    );
    builder.add(
      'README.txt',
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
        `  site.webmanifest           Tells phones the name and colours to use when somebody installs your site.`,
        '',
        'A note on caching: browsers hold on to favicons stubbornly. If you are',
        'replacing an old one and it looks unchanged, try a private window before',
        'concluding something went wrong.',
        '',
        'Made with the free favicon maker at meetpiggles.com/tools/favicon',
      ].join('\n')
    );
    return builder.build();
  };

  return { files, manifest, html, nextjs, zip };
}
