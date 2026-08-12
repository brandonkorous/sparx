// Redirects — the difference between a migration and a traffic loss.
//
// A tenant who has ranked for eight years at `/2019/07/how-to-bleed-a-fuel-system/`
// and moves to `/blog/how-to-bleed-a-fuel-system` has, on the day they switch DNS,
// thrown away every link anyone ever made to that page. Search engines drop the old
// URL, the backlinks 404, and the traffic does not come back on its own.
//
// This is why the WXR reader builds a redirect for every post whose old permalink
// differs from its new slug, and why Shopify's own redirect export is imported too:
// a tenant leaving Shopify usually has years of accumulated redirects there already,
// and losing THOSE undoes work they did on the platform they are leaving.
//
// Redirects are site-scoped. Two sites under one tenant have unrelated path spaces —
// `/specials` means one thing on a donut site and another on a parts site — so an
// imported rule belongs to the site being migrated, never to all of them.

import { withTenant } from '@sparx/db';
import { toPath } from '@sparx/migration';

import {
  eachRow,
  type EntityProcessor,
  type ImportRow,
  type PreviewResult,
  type RowResult,
} from './types';

function readPaths(row: ImportRow): { from: string | undefined; to: string | undefined } {
  const from = toPath(row.from) ?? normalise(row.from);
  const to = toPath(row.to) ?? normalise(row.to);
  return { from, to };
}

/** A redirect target may legitimately be an absolute URL on another domain, which
 *  `toPath` reduces away. Anything that already looks like a path is kept as-is. */
function normalise(value: string | undefined): string | undefined {
  const text = (value ?? '').trim();
  if (text === '') return undefined;
  if (/^https?:\/\//i.test(text)) return text;
  return text.startsWith('/') ? text : `/${text}`;
}

export const redirectsProcessor: EntityProcessor = {
  entity: 'redirects',
  module: 'builder',

  async run(ctx, rows, options, logger) {
    return eachRow<RowResult>(
      rows,
      logger,
      async (row, rowIndex) => {
        const { from, to } = readPaths(row);
        if (from === undefined || to === undefined) {
          return {
            rowIndex,
            status: 'error',
            errorMsg: 'A redirect needs both an old address and a new one.',
          };
        }
        if (from === to) {
          return {
            rowIndex,
            status: 'skipped',
            naturalKey: from,
            errorMsg: 'The old and new addresses are the same, so no redirect is needed.',
          };
        }

        const statusCode = row.status_code === '302' ? 302 : 301;
        const propertyId = ctx.propertyId ?? null;

        const existing = await withTenant(ctx, (tx) =>
          tx.redirect.findFirst({
            where: { tenantId: ctx.tenantId, propertyId, fromPath: from },
            select: { id: true, toPath: true },
          })
        );

        if (existing !== null && !options.upsert) {
          return { rowIndex, status: 'skipped', naturalKey: from };
        }

        if (existing !== null) {
          if (existing.toPath === to) return { rowIndex, status: 'skipped', naturalKey: from };
          await withTenant(ctx, (tx) =>
            tx.redirect.update({
              where: { id: existing.id },
              data: { toPath: to, statusCode },
            })
          );
          return { rowIndex, status: 'updated', naturalKey: from };
        }

        await withTenant(ctx, (tx) =>
          tx.redirect.create({
            data: { tenantId: ctx.tenantId, propertyId, fromPath: from, toPath: to, statusCode },
          })
        );
        return { rowIndex, status: 'imported', naturalKey: from };
      },
      (rowIndex, message) => ({ rowIndex, status: 'error', errorMsg: message })
    );
  },

  async preview(ctx, rows, logger) {
    const propertyId = ctx.propertyId ?? null;
    return eachRow<PreviewResult>(
      rows,
      logger,
      async (row, rowIndex) => {
        const { from, to } = readPaths(row);
        if (from === undefined || to === undefined)
          return { rowIndex, action: 'error', errorMsg: 'Needs both an old and a new address.' };
        if (from === to)
          return { rowIndex, action: 'skip', naturalKey: from, errorMsg: 'Points at itself.' };

        const existing = await withTenant(ctx, (tx) =>
          tx.redirect.findFirst({
            where: { tenantId: ctx.tenantId, propertyId, fromPath: from },
            select: { id: true },
          })
        );
        return { rowIndex, action: existing === null ? 'create' : 'update', naturalKey: from };
      },
      (rowIndex, message) => ({ rowIndex, action: 'error', errorMsg: message })
    );
  },
};
