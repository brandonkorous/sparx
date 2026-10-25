import { beforeEach, describe, expect, it, vi } from 'vitest';

// WW-8: unknown paths (`/api/phpinfo.php`, `/config.js`) sometimes answered 200.
// The browser shell streamed before the page's late notFound(); metadata now
// blocks the response (htmlLimitedBots) and decides the 404 itself.

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
  it('is a real 404 when nothing owns the slug, after trying redirects', async () => {
    for (let i = 0; i < 20; i++) {
      await expect(generateMetadata(props('definitely-missing.php'))).rejects.toThrow(
        'NEXT_NOT_FOUND'
      );
    }
    expect(h.redirect).toHaveBeenCalledWith('acme', '/definitely-missing.php');
  });

  it('keeps a page that only has Site Builder sections', async () => {
    h.snapshot.mockResolvedValue({ keys: ['about'] });
    await expect(generateMetadata(props('about'))).resolves.toEqual({});
  });

  it('is a 404 for a slug too long to be a page, without any page lookup', async () => {
    await expect(generateMetadata(props('a'.repeat(300)))).rejects.toThrow('NEXT_NOT_FOUND');
    expect(h.silica).not.toHaveBeenCalled();
    expect(h.redirect).toHaveBeenCalledOnce();
  });

  it('blocks on metadata for every visitor, not only known crawlers', () => {
    const chrome = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/148.0';
    expect(config.htmlLimitedBots?.test(chrome)).toBe(true);
  });
});
