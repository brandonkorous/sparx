import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Every write to a site's pages tells search (sparx persona issue 130).
 *
 * Gillett Diesel typed "About" with the About page open in the editor behind the
 * search box and was told "Nothing in your records matches". Pages are written
 * from many places, so each writer runs inside `withPageSearch`, which signals
 * every page the site held before the write and holds after it.
 */

let rows: { id: string; name: string }[] = [];

vi.mock('@wizeworks/db', () => ({
  withTenant: (_ctx: unknown, fn: (tx: unknown) => unknown) =>
    Promise.resolve(
      fn({
        builderPage: {
          findMany: () => Promise.resolve(rows.map((r) => ({ id: r.id }))),
          findFirst: ({ where }: { where: { id: string } }) =>
            Promise.resolve(rows.find((r) => r.id === where.id) ?? null),
          delete: ({ where }: { where: { id: string } }) => {
            rows = rows.filter((r) => r.id !== where.id);
            return Promise.resolve();
          },
        },
      })
    ),
}));
vi.mock('../audit', () => ({ writeAuditLog: () => Promise.resolve() }));

const signalled: { entityType: string; recordId: string }[] = [];
vi.mock('@wizeworks/events', () => ({
  indexEntity: (input: { entityType: string; recordId: string }) => {
    signalled.push({ entityType: input.entityType, recordId: input.recordId });
    return Promise.resolve();
  },
}));

const { remove } = await import('./page-service');

const ctx = { tenantId: 't-1', propertyId: 'site-1', userId: 'u-1' };

describe('a page write tells search', () => {
  beforeEach(() => {
    signalled.length = 0;
    rows = [
      { id: 'home', name: 'Home' },
      { id: 'about', name: 'About' },
    ];
  });

  it('signals a removed page, so its search entry is removed too', async () => {
    await remove(ctx, 'about');
    expect(signalled).toEqual([
      { entityType: 'builder_page', recordId: 'home' },
      { entityType: 'builder_page', recordId: 'about' },
    ]);
  });
});

describe('every page writer is wrapped', () => {
  const HERE = dirname(fileURLToPath(import.meta.url));
  const WRITERS: Record<string, string[]> = {
    'page-service.ts': ['create', 'update', 'remove', 'publish'],
    'site-service.ts': ['sync', 'reset', 'publishPage', 'publish', 'installSite', 'addPage'],
  };

  for (const [file, names] of Object.entries(WRITERS)) {
    it(`${file}: ${names.join(', ')}`, () => {
      const source = readFileSync(join(HERE, file), 'utf8');
      for (const name of names) {
        const at = source.indexOf(`export function ${name}(`);
        expect(at, `${file} exports ${name} as a wrapper`).toBeGreaterThan(-1);
        const body = source.slice(at, source.indexOf('\n}\n', at));
        expect(body, name).toContain(`withPageSearch(args[0], () => ${name}Write(...args))`);
      }
    });
  }

  it('the seeding reads signal what they create', () => {
    const page = readFileSync(join(HERE, 'page-service.ts'), 'utf8');
    expect(page).toContain('if (home) indexPages(ctx, [home.id]);');
    expect(page).toMatch(
      /if \(seeded\) \{\s*indexPages\(\s*ctx,\s*pages\.map\(\(p\) => p\.id\)\s*\);/
    );
    const site = readFileSync(join(HERE, 'site-service.ts'), 'utf8');
    expect(site).toContain('if (seededRecordPages) await indexSitePages(ctx);');
  });
});
