import { beforeEach, describe, expect, it, vi } from 'vitest';

// WW-8: generateMetadata used to call notFound() for a slug nothing owns. Next 16
// had already sent a 200 head, so it was only noise; real 404s for scanner paths
// come from the proxy (lib/probe-path).

const h = vi.hoisted(() => ({
  silica: vi.fn(),
  builder: vi.fn(),
  piece: vi.fn(),
  page: vi.fn(),
  snapshot: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));
vi.mock('@/lib/site-context', () => ({
  resolveSite: () => Promise.resolve({ slug: 'acme', name: 'Acme', billingPhase: 'active' }),
  resolveActivePropertySlug: () => Promise.resolve(null),
}));
vi.mock('@/lib/silica', () => ({ getPublishedSilicaPage: h.silica }));
vi.mock('@/lib/builder', () => ({ getPublishedBuilderPage: h.builder }));
vi.mock('@/lib/kind-pieces', () => ({ getKindPiece: h.piece }));
vi.mock('@/lib/content', () => ({ getPageBySlug: h.page }));
vi.mock('@/lib/site', () => ({
  getPublishedSite: h.snapshot,
  sectionsForPage: (snap: { keys?: string[] } | null, key: string) =>
    snap?.keys?.includes(key) ? [{ pageKey: key }] : [],
}));
vi.mock('@/lib/redirects', () => ({ applyRedirect: h.redirect }));
vi.mock('@/lib/site-modules', () => ({ requireSiteModule: vi.fn() }));
vi.mock('@/components/kind-piece-page', () => ({
  KindPiecePage: vi.fn(),
  kindPieceMetadata: vi.fn(),
}));
vi.mock('@/components/page-view', () => ({ PageView: vi.fn() }));
vi.mock('@/components/section-renderer', () => ({ SectionRenderer: vi.fn() }));
vi.mock('./authored-page', () => ({ SilicaSlugPage: vi.fn(), BuilderSlugPage: vi.fn() }));

import config from '../../next.config.mjs';
import { NOT_FOUND_METADATA } from '@/lib/slug-metadata';
import { generateMetadata } from './page';

const props = (...slug: string[]) => ({
  params: Promise.resolve({ slug }),
  searchParams: Promise.resolve({}),
});

beforeEach(() => {
  vi.clearAllMocks();
  for (const fn of [h.silica, h.builder, h.piece, h.page, h.snapshot]) fn.mockResolvedValue(null);
});

describe('catch-all metadata', () => {
  // Next 16 sends the 200 head before metadata resolves, so a notFound() here never
  // became a 404; it only added an exception per scanner request.
  it('says not found without throwing when nothing owns the slug', async () => {
    await expect(generateMetadata(props('definitely-missing'))).resolves.toEqual(
      NOT_FOUND_METADATA
    );
    expect(h.redirect).not.toHaveBeenCalled();
  });

  it('keeps a page that only has Site Builder sections', async () => {
    h.snapshot.mockResolvedValue({ keys: ['about'] });
    await expect(generateMetadata(props('about'))).resolves.toEqual({});
  });

  it('skips every lookup for a slug too long to be a page', async () => {
    await expect(generateMetadata(props('a'.repeat(300)))).resolves.toEqual(NOT_FOUND_METADATA);
    expect(h.silica).not.toHaveBeenCalled();
  });

  it('leaves metadata streaming as Next ships it', () => {
    expect(config.htmlLimitedBots).toBeUndefined();
  });
});
