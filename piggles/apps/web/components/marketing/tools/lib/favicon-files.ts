/**
 * The six image files, drawn. Each exists because some platform asks for it and
 * falls back badly without it; the set is deliberately no longer than this.
 */

import { canvasToBlob, drawSquare, type LoadedImage } from './canvas';
import { buildIco } from './ico';
import type { FaviconFile, FaviconOptions } from './favicon-types';

/** The .ico carries three sizes in one file: the tab, the tab on a sharp screen,
 *  and the Windows taskbar. */
const ICO_SIZES = [16, 32, 48];

export async function buildFaviconFiles(
  image: LoadedImage,
  opts: FaviconOptions
): Promise<FaviconFile[]> {
  // Nothing here ever ERASES a background — there is no color-keying in this
  // tool at all. A see-through pixel reaches an icon only from the picture
  // already having one, or from a rectangle being fitted into a square.
  const fill = opts.fillBackground ? opts.background : undefined;

  const png = async (size: number, background = fill, padding?: number) =>
    canvasToBlob(drawSquare(image, { size, background, padding, fit: 'contain' }));

  const icoEntries = await Promise.all(
    ICO_SIZES.map(async (size) => ({ size, png: await (await png(size)).arrayBuffer() }))
  );

  return [
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
}
