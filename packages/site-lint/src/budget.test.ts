import { describe, expect, it } from 'vitest';
import { bind, el, outlet, type ElementNode, type Node } from '@wizeworks/silicaui-html';

import { imageSourcesOf, lintSite, WEIGHT_BUDGET } from './index';
import type { LintablePage, SiteLintInput } from './types';

/* ── Fixtures ───────────────────────────────────────────────────────────────── */

function page(overrides: Partial<LintablePage> & { root: Node }): LintablePage {
  return {
    id: 'p1',
    name: 'Home',
    slug: '/',
    seoTitle: 'Home — Example',
    seoDescription: 'A description that is not shared with any other page.',
    ...overrides,
  };
}

function body(...children: Node[]): ElementNode {
  return el('main', '', { children: [el('h1', '', { text: 'The page' }), ...children] });
}

const img = (src: string): Node => el('img', '', { attrs: { src, alt: 'A picture' } });

function budgetOf(input: Partial<SiteLintInput> & { pages: LintablePage[] }) {
  return lintSite({ ...input }).budget;
}

/* ── Naming the pictures ────────────────────────────────────────────────────── */

describe('imageSourcesOf', () => {
  it('names every picture across pages, the frame and saved pieces, once each', () => {
    const sources = imageSourcesOf({
      pages: [
        page({ root: body(img('/media/hero.jpg'), img('/media/hero.jpg')) }),
        page({ id: 'p2', name: 'About', slug: '/about', root: body(img('/media/team.jpg')) }),
      ],
      frame: { root: el('div', '', { children: [img('/media/logo.svg'), outlet()] }) },
      symbols: {
        card: {
          id: 'card',
          name: 'Card',
          root: el('div', '', { children: [img('/media/card.jpg')] }),
        },
      },
    });

    expect(sources).toEqual([
      '/media/card.jpg',
      '/media/hero.jpg',
      '/media/logo.svg',
      '/media/team.jpg',
    ]);
  });

  it('leaves out an inline picture — there is nothing to look up', () => {
    // The file IS the attribute, so the engine weighs it directly. Asking a media
    // library about a 40 KB data URI returns nothing and teaches nobody anything.
    const sources = imageSourcesOf({
      pages: [page({ root: body(img('data:image/svg+xml;base64,PHN2Zy8+')) })],
    });
    expect(sources).toEqual([]);
  });
});

/* ── Weight ─────────────────────────────────────────────────────────────────── */

describe('page weight', () => {
  it('counts the markup a visitor receives, frame included', () => {
    const bare = budgetOf({ pages: [page({ root: body() })] });
    const framed = budgetOf({
      pages: [page({ root: body() })],
      frame: {
        root: el('footer', '', { children: [outlet(), el('p', '', { text: 'x'.repeat(500) })] }),
      },
    });

    expect(bare.pages[0]?.htmlBytes).toBeGreaterThan(0);
    expect(framed.pages[0]?.htmlBytes).toBeGreaterThan((bare.pages[0]?.htmlBytes ?? 0) + 500);
  });

  it('adds up the pictures it was given sizes for', () => {
    const budget = budgetOf({
      pages: [page({ root: body(img('/media/hero.jpg'), img('/media/team.jpg')) })],
      imageBytes: { '/media/hero.jpg': 400_000, '/media/team.jpg': 100_000 },
    });

    expect(budget.pages[0]?.imageCount).toBe(2);
    expect(budget.pages[0]?.imageBytes).toBe(500_000);
    expect(budget.pages[0]?.imagesUnsized).toBe(0);
  });

  it('counts the same picture once however many times it appears', () => {
    // A logo in the header and again in the footer is one download.
    const budget = budgetOf({
      pages: [page({ root: body(img('/media/logo.svg'), img('/media/logo.svg')) })],
      imageBytes: { '/media/logo.svg': 20_000 },
    });
    expect(budget.pages[0]?.imageCount).toBe(1);
    expect(budget.pages[0]?.imageBytes).toBe(20_000);
  });

  it('reports a picture of unknown size as unsized rather than as free', () => {
    // The alternative — treating a missing lookup as zero — makes a hot-linked 4 MB
    // hero photo read as weightless, which is the one direction this must not fail in.
    const budget = budgetOf({
      pages: [page({ root: body(img('https://images.example.com/hero.jpg')) })],
      imageBytes: {},
    });
    expect(budget.pages[0]?.imageBytes).toBe(0);
    expect(budget.pages[0]?.imagesUnsized).toBe(1);
    expect(budget.unsizedImages).toBe(1);
  });

  it('counts a picture that comes from a record, and admits it cannot weigh it', () => {
    // A product grid is not a page with no pictures on it.
    const bound = bind(el('img', '', { attrs: { alt: 'The product' } }), 'item.image');
    const budget = budgetOf({ pages: [page({ root: body(bound) })] });
    expect(budget.pages[0]?.imageCount).toBe(1);
    expect(budget.pages[0]?.imagesUnsized).toBe(1);
    // No file, so nothing distinct to add to the site-wide file count.
    expect(budget.unsizedImages).toBe(0);
  });

  it('weighs an inline picture without being told its size', () => {
    const payload = 'A'.repeat(4000);
    const budget = budgetOf({
      pages: [page({ root: body(img(`data:image/png;base64,${payload}`)) })],
    });
    expect(budget.pages[0]?.imageBytes).toBe(3000);
    expect(budget.pages[0]?.imagesUnsized).toBe(0);
  });
});

/* ── Reading the numbers ────────────────────────────────────────────────────── */

describe('bands and ranking', () => {
  it('calls a light page light and a picture-heavy one very heavy', () => {
    const budget = budgetOf({
      pages: [
        page({ root: body() }),
        page({ id: 'p2', name: 'Gallery', slug: '/gallery', root: body(img('/media/big.jpg')) }),
      ],
      imageBytes: { '/media/big.jpg': WEIGHT_BUDGET.pageVeryHeavy + 1 },
    });

    // Heaviest first: the gallery leads, whatever order the pages were authored in.
    expect(budget.pages[0]?.pageName).toBe('Gallery');
    expect(budget.pages[0]?.band).toBe('very-heavy');
    expect(budget.pages[1]?.band).toBe('light');
    expect(budget.heaviestPageBytes).toBe(budget.pages[0]?.totalBytes);
  });

  it('names a heavy picture and says how many pages carry it', () => {
    const budget = budgetOf({
      pages: [
        page({ root: body() }),
        page({ id: 'p2', name: 'About', slug: '/about', root: body() }),
      ],
      frame: { root: el('div', '', { children: [img('/media/logo.png'), outlet()] }) },
      imageBytes: { '/media/logo.png': 900_000 },
    });

    expect(budget.heavyImages).toEqual([{ src: '/media/logo.png', bytes: 900_000, pageCount: 2 }]);
  });

  it('leaves an ordinary picture out of the named list', () => {
    const budget = budgetOf({
      pages: [page({ root: body(img('/media/ok.jpg')) })],
      imageBytes: { '/media/ok.jpg': WEIGHT_BUDGET.imageHeavy - 1 },
    });
    expect(budget.heavyImages).toEqual([]);
  });

  it('counts styling that emits no CSS by NAME, not by block', () => {
    // One typo repeated across three blocks is one thing to fix. The findings list
    // points at all three; this number says how many names are wrong.
    const budget = budgetOf({
      pages: [
        page({
          root: body(
            el('div', 'gap-7', { text: 'one' }),
            el('div', 'gap-7', { text: 'two' }),
            el('div', 'gap-7', { text: 'three' })
          ),
        }),
      ],
    });
    expect(budget.unbackedClasses).toEqual(['gap-7']);
  });

  it('says nothing about weight in the findings', () => {
    // The whole point of the budget being a measurement: a heavy page is a trade the
    // owner made, so it must not raise a finding or move `status`.
    const report = lintSite({
      pages: [page({ root: body(img('/media/huge.jpg')) })],
      imageBytes: { '/media/huge.jpg': 50_000_000 },
    });
    expect(report.status).toBe('pass');
    expect(report.findings).toEqual([]);
    expect(report.budget.pages[0]?.band).toBe('very-heavy');
  });
});
