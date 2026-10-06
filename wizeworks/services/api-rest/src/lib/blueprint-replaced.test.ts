// Which installs read as "Pages gone" (persona issue 273): an install that had
// pages on its site and has none of them left. Devi's main site listed Fashion
// Boutique (Minimal) as "Added as drafts" for six weeks over nine pages a later
// design had replaced.

import { describe, expect, it, vi } from 'vitest';

const artifacts = vi.hoisted(
  () => [] as { installId: string; kind: string; refId: string | null }[]
);
const livePages = vi.hoisted(() => new Set<string>());

vi.mock('@wizeworks/db', () => ({
  withTenant: (_ctx: unknown, fn: (tx: unknown) => unknown) =>
    Promise.resolve(
      fn({
        tenantBlueprintInstallArtifact: {
          findMany: ({ where }: { where: { installId: { in: string[] }; kind: string } }) =>
            Promise.resolve(
              artifacts.filter(
                (a) => where.installId.in.includes(a.installId) && a.kind === where.kind && a.refId
              )
            ),
        },
        builderPage: {
          findMany: ({ where }: { where: { id: { in: string[] } } }) =>
            Promise.resolve(where.id.in.filter((id) => livePages.has(id)).map((id) => ({ id }))),
        },
      })
    ),
}));

const { replacedInstallIds } = await import('./blueprint-replaced.js');

function given(rows: { installId: string; kind?: string; refId: string | null }[], live: string[]) {
  artifacts.length = 0;
  artifacts.push(...rows.map((r) => ({ kind: 'page', ...r })));
  livePages.clear();
  for (const id of live) livePages.add(id);
}

describe('an install whose pages are all gone', () => {
  it('reads as gone when none of its pages exist', async () => {
    given(
      [
        { installId: 'minimal', refId: 'p1' },
        { installId: 'minimal', refId: 'p2' },
      ],
      []
    );
    expect(await replacedInstallIds('t', ['minimal'])).toEqual(new Set(['minimal']));
  });

  it('does not while even one of its pages is still there', async () => {
    given(
      [
        { installId: 'minimal', refId: 'p1' },
        { installId: 'minimal', refId: 'p2' },
      ],
      ['p2']
    );
    expect(await replacedInstallIds('t', ['minimal'])).toEqual(new Set());
  });

  it('never for a design that brought no pages at all', async () => {
    given([{ installId: 'emails-only', kind: 'email', refId: 'e1' }], []);
    expect(await replacedInstallIds('t', ['emails-only'])).toEqual(new Set());
  });

  it('tells two installs apart on one site', async () => {
    given(
      [
        { installId: 'old', refId: 'p1' },
        { installId: 'new', refId: 'p9' },
      ],
      ['p9']
    );
    expect(await replacedInstallIds('t', ['old', 'new'])).toEqual(new Set(['old']));
  });
});
