/** One picture in, the whole set a real website needs out. */

import type { LoadedImage } from './canvas';
import { buildFaviconFiles } from './favicon-files';
import { headHtml, manifestJson, nextjsNote, readmeText } from './favicon-snippets';
import type { FaviconFile, FaviconOptions } from './favicon-types';
import { ZipBuilder } from './zip';

export type { FaviconFile, FaviconOptions } from './favicon-types';

export interface FaviconOutput {
  files: FaviconFile[];
  manifest: string;
  html: string;
  nextjs: string;
  zip: () => Promise<Blob>;
}

export async function buildFaviconSet(
  image: LoadedImage,
  opts: FaviconOptions
): Promise<FaviconOutput> {
  const files = await buildFaviconFiles(image, opts);
  const manifest = manifestJson(opts);
  const html = headHtml(opts);

  const zip = async () => {
    const builder = new ZipBuilder();
    for (const file of files) builder.add(file.name, await file.blob.arrayBuffer());
    builder.add('site.webmanifest', manifest);
    builder.add(
      'paste-into-your-head.html',
      `<!-- Put these inside the <head> of every page. -->\n${html}\n`
    );
    builder.add('README.txt', readmeText(files, opts));
    return builder.build();
  };

  return { files, manifest, html, nextjs: nextjsNote(opts), zip };
}
