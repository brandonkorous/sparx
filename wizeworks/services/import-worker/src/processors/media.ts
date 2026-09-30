// Images and files.
//
// A migration that brings the words and leaves the pictures behind has moved a site's
// skeleton. The fetching, de-duplication and fallback all live in `./images`, shared
// with the product processor so a catalogue's galleries and a media library behave
// identically; this file is the entity wrapper around it.
//
// The columns read are the canonical field keys (`ENTITY_FIELDS.media`), held equal
// by `contract.test.ts`. A caption is saved onto the file. Title and upload date are
// off that list: a file here has no title of its own (its name and alt text are what
// it carries), and the date it was added is stamped when it arrives.

import { withTenant } from '@wizeworks/db';

import { filenameFromUrl, ingestImage, linkedNotice } from './images';
import { eachRow, type EntityProcessor, type PreviewResult, type RowResult } from './types';

export const mediaProcessor: EntityProcessor = {
  entity: 'media',
  module: null,

  async run(ctx, rows, options, logger) {
    return eachRow<RowResult>(
      rows,
      logger,
      async (row, rowIndex) => {
        const url = (row.url ?? '').trim();
        if (url === '') {
          return { rowIndex, status: 'error', errorMsg: 'This row has no file address.' };
        }
        const filename = filenameFromUrl(url, row.filename);

        const result = await ingestImage(ctx, url, {
          ...(row.filename !== undefined ? { filename: row.filename } : {}),
          ...(row.alt !== undefined ? { alt: row.alt } : {}),
        });

        // The caption, on a file this import brought in, or on one already here when
        // the import is allowed to update what it finds. Written directly: it is a
        // plain field the library edits the same way, and no media service input
        // carries it.
        const caption = (row.caption ?? '').trim();
        if (caption !== '' && (!result.reused || options.upsert)) {
          await withTenant(ctx, (tx) =>
            tx.mediaAsset.update({
              where: { id: result.assetId },
              data: { caption: caption.slice(0, 2000) },
            })
          );
        }

        if (result.reused) {
          return {
            rowIndex,
            status: options.upsert ? 'updated' : 'skipped',
            naturalKey: filename,
          };
        }

        return {
          rowIndex,
          status: 'imported',
          naturalKey: filename,
          ...(result.copied
            ? {}
            : { errorMsg: linkedNotice(result.reason ?? 'we could not fetch it') }),
        };
      },
      (rowIndex, message) => ({ rowIndex, status: 'error', errorMsg: message })
    );
  },

  async preview(ctx, rows, logger) {
    // Deliberately fetches NOTHING. A preview that pulled 4,000 images would take
    // longer than the import and would hammer a site the tenant is still running.
    return eachRow<PreviewResult>(
      rows,
      logger,
      async (row, rowIndex) => {
        const url = (row.url ?? '').trim();
        if (url === '') return { rowIndex, action: 'error', errorMsg: 'No file address.' };
        const filename = filenameFromUrl(url, row.filename);
        const existing = await withTenant(ctx, (tx) =>
          tx.mediaAsset.findFirst({
            where: {
              tenantId: ctx.tenantId,
              deletedAt: null,
              OR: [{ key: url }, { originalFilename: filename }],
            },
            select: { id: true },
          })
        );
        return { rowIndex, action: existing === null ? 'create' : 'skip', naturalKey: filename };
      },
      (rowIndex, message) => ({ rowIndex, action: 'error', errorMsg: message })
    );
  },
};
