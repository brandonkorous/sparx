// The house page measure (piggles persona issue 950).
//
// The defect was a left edge: at 1,280px her header's name sat at x=88 and the heading of
// every page built from the catalog at x=64. Nothing about any one band looked wrong, so
// these tests measure the EDGE, not the classes of one factory: for the header, the
// footer and every catalog band, where does the content box start, and does anything
// above it pad the page as well? Every answer has to be the same box.

import { describe, expect, it } from 'vitest';
import { el, type Node } from '@wizeworks/silicaui-html';

import { SPARX_CATALOG } from './catalog';
import { HOST_COMPONENTS } from './host-nodes';
import {
  headerToInsideMeasure,
  insideMeasure,
  isCapturedHeader,
  isOutsideMeasureBand,
  measureRepair,
  siteInsideMeasure,
} from './page-measure';
import { recordPages, starterSite } from './site';
import {
  FOOTER_VARIANTS,
  NAVBAR_VARIANTS,
  siteFooter,
  siteNavbar,
  type FooterVariant,
  type NavbarVariant,
} from './site-chrome';
import { upgradeFrameChrome } from './upgrade-frame';
import { pageHeader } from './sections/layout';

type Element = Extract<Node, { kind: 'element' }>;

const tokens = (cls: string | undefined) => (cls ?? '').split(/\s+/).filter(Boolean);
const isSidePadding = (token: string) =>
  /^(p|px|pl|pr|ps|pe)-/.test(token.slice(token.lastIndexOf(':') + 1));

/** Where a band's content starts: the first `mx-auto max-w-6xl` box under it, and every
 *  side padding on the way down to it (the band's own included). Null when the band has
 *  no 6xl measure at all, which a centered reading column legitimately does not. */
function contentEdge(band: Node): { box: string[]; paddingAbove: string[] } | null {
  const walk = (node: Node | string, above: string[]): ReturnType<typeof contentEdge> => {
    if (typeof node === 'string' || node.kind !== 'element') return null;
    const t = tokens(node.class);
    if (t.includes('mx-auto') && t.includes('max-w-6xl')) return { box: t, paddingAbove: above };
    const here = [...above, ...t.filter(isSidePadding)];
    for (const child of node.children ?? []) {
      const hit = walk(child, here);
      if (hit) return hit;
    }
    return null;
  };
  return walk(band, []);
}

/** The house edge: the gutter in the box, and nothing above it padding the page. */
function expectHouseEdge(band: Node, what: string): void {
  const edge = contentEdge(band);
  expect(edge, `${what} has a 6xl content box`).not.toBeNull();
  expect(edge!.paddingAbove, `${what}: side padding outside its measure`).toEqual([]);
  expect(edge!.box.filter(isSidePadding), `${what}: the measure's own gutter`).toEqual(['px-6']);
}

const NAVBARS = Object.keys(NAVBAR_VARIANTS) as NavbarVariant[];
const FOOTERS = Object.keys(FOOTER_VARIANTS) as FooterVariant[];

describe('every band starts its content on the same left edge', () => {
  it('a page built from Page top, under every header and over every footer', () => {
    const pageTop = pageHeader();
    for (const navbar of NAVBARS) expectHouseEdge(siteNavbar({ navbar }), `navbar ${navbar}`);
    expectHouseEdge(pageTop, 'Page top');
    for (const footer of FOOTERS) expectHouseEdge(siteFooter({ footer }), `footer ${footer}`);
  });

  it('every catalog band that is on the 6xl measure', () => {
    let measured = 0;
    for (const group of SPARX_CATALOG) {
      for (const item of group.items) {
        const tree = item.make();
        // A centered reading column (`max-w-3xl`) is never on the page edge; it has no
        // 6xl box and is not what this is about.
        if (!contentEdge(tree)) continue;
        expectHouseEdge(tree, `${group.key}/${item.key}`);
        measured += 1;
      }
    }
    // Not vacuous: most of the shelf is on the measure.
    expect(measured).toBeGreaterThan(60);
  });

  it('every band of the starter site and of every record page', () => {
    const opts = { commerceEnabled: true, cmsEnabled: true, schedulingEnabled: true };
    const site = starterSite(undefined, opts);
    const pages = [...site.pages, ...recordPages(opts)];
    for (const page of pages) {
      const bands = page.root.kind === 'element' ? (page.root.children ?? []) : [];
      for (const band of bands) {
        if (typeof band === 'string' || !contentEdge(band)) continue;
        expectHouseEdge(band, `${page.name} band`);
      }
    }
  });

  it('every list the site draws itself', () => {
    const lists = HOST_COMPONENTS.filter((c) => tokens(c.defaultClass).includes('max-w-6xl'));
    expect(lists.length).toBeGreaterThan(0);
    for (const list of lists) {
      expect(tokens(list.defaultClass).filter(isSidePadding), list.key).toEqual(['px-6']);
    }
  });
});

/** A band exactly as `section()` stamped it before issue 950. */
const outsideBand = (): Element =>
  el('section', 'bg-base-100 @container px-6 py-16', {
    children: [
      el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-10', {
        children: [el('h1', 'text-4xl font-semibold', { text: 'Archive' })],
      }),
    ],
  });

describe('measureRepair: exactly the old shapes', () => {
  it('moves the gutter from the band into the box, and keeps everything else', () => {
    const healed = measureRepair(outsideBand())!;
    expect(healed.class).toBe('bg-base-100 @container py-16');
    const box = healed.children![0] as Element;
    expect(box.class).toBe('mx-auto flex w-full max-w-6xl px-6 flex-col gap-10');
    expect(contentEdge(healed)!.paddingAbove).toEqual([]);
  });

  it('heals to exactly what the factory stamps today', () => {
    // `section()` now: band and box, byte for byte.
    const fresh = pageHeader() as Element;
    const stale = pageHeader() as Element;
    stale.class = `${stale.class} px-6`;
    const box = stale.children![0] as Element;
    box.class = tokens(box.class)
      .filter((t) => t !== 'px-6')
      .join(' ');
    expect(isOutsideMeasureBand(stale)).toBe(true);
    const healed = measureRepair(stale)!;
    expect(tokens(healed.class).sort()).toEqual(tokens(fresh.class).sort());
    expect((healed.children![0] as Element).class).toBe((fresh.children![0] as Element).class);
  });

  it('moves the gutter into EVERY box of a two-box band (the captured footer)', () => {
    const footer = el('footer', '@container border-t bg-base-200 px-6 py-12', {
      children: [
        el('div', 'mx-auto grid max-w-6xl gap-10', { children: [] }),
        el('div', 'mx-auto mt-10 max-w-6xl border-t pt-6', { children: [] }),
      ],
    });
    const healed = measureRepair(footer)!;
    expect(tokens(healed.class)).not.toContain('px-6');
    for (const child of healed.children ?? []) {
      expect(tokens((child as Element).class)).toContain('px-6');
    }
  });

  it('drops the picture band’s wider desktop gutter, and only that', () => {
    const box = el(
      'div',
      'relative mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-16 @3xl:px-10 @3xl:py-20'
    );
    expect(measureRepair(box)!.class).toBe(
      'relative mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-16 @3xl:py-20'
    );
  });

  it('leaves alone anything an author shaped differently', () => {
    const author = [
      // Padded by the author, not the platform's px-6.
      el('section', 'px-8 py-16', { children: [el('div', 'mx-auto max-w-6xl')] }),
      // A wider desktop gutter on top of the band's.
      el('section', 'px-6 @3xl:px-12 py-16', { children: [el('div', 'mx-auto max-w-6xl')] }),
      // Something beside the measure, which the gutter still has to pad.
      el('section', 'px-6 py-16', {
        children: [el('h2', '', { text: 'Hi' }), el('div', 'mx-auto max-w-6xl')],
      }),
      // A reading column: centered, never on the page edge.
      el('section', 'px-6 py-16', { children: [el('div', 'mx-auto max-w-3xl')] }),
      // Already the house shape.
      el('section', 'py-16', { children: [el('div', 'mx-auto max-w-6xl px-6')] }),
      // A div the author wrapped content in.
      el('div', 'px-6', { children: [el('div', 'mx-auto max-w-6xl')] }),
      // A box with its own wider gutter that is not the stamped pair.
      el('div', 'mx-auto max-w-6xl px-4 @3xl:px-10'),
    ];
    for (const node of author) expect(measureRepair(node)).toBeNull();
  });
});

describe('insideMeasure: the walk', () => {
  it('heals a band wherever it sits, and keeps the identity of everything else', () => {
    const untouched = el('section', 'py-16', { children: [el('div', 'mx-auto max-w-6xl px-6')] });
    const root = el('div', '', {
      children: [untouched, el('div', '', { children: [outsideBand()] })],
    });
    const { root: healed, changed } = insideMeasure(root);
    expect(changed).toBe(true);
    const kids = (healed as Element).children!;
    expect(kids[0]).toBe(untouched);
    expect(contentEdge(kids[1] as Node)!.paddingAbove).toEqual([]);
  });

  it('is idempotent, and says so', () => {
    const once = insideMeasure(outsideBand()).root;
    const twice = insideMeasure(once);
    expect(twice.changed).toBe(false);
    expect(twice.root).toBe(once);
  });

  it('siteInsideMeasure heals every page and the frame', () => {
    const site = {
      frame: { root: el('div', '', { children: [outsideBand()] }) as Node },
      pages: [{ name: 'Archive', root: outsideBand() as Node }],
    };
    const healed = siteInsideMeasure(site);
    expect(isOutsideMeasureBand(healed.pages[0]!.root)).toBe(false);
    expect(contentEdge(healed.frame.root)!.paddingAbove).toEqual([]);
    expect(healed.pages[0]!.name).toBe('Archive');
  });
});

/** The golden capture's frame: a full-width bar and a footer with its gutter outside. */
const capturedFrame = (): Node =>
  el('div', 'min-h-screen flex flex-col bg-base-100', {
    children: [
      el(
        'nav',
        '@container flex items-center justify-between gap-6 border-b border-base-300 bg-base-100 px-6 py-4',
        {
          attrs: { 'aria-label': 'Primary' },
          children: [
            el('span', 'wordmark', { text: 'Acme' }),
            el('div', 'flex items-center gap-3', { children: [el('a', '', { text: 'About' })] }),
          ],
        }
      ),
      el('main', 'flex-1', { children: [{ kind: 'outlet' }] }),
      el('footer', '@container border-t border-base-300 bg-base-200 px-6 py-12', {
        children: [
          el('div', 'mx-auto grid max-w-6xl gap-10 @sm:grid-cols-2', {
            children: [el('p', '', { text: 'Acme' })],
          }),
          el('div', 'mx-auto mt-10 max-w-6xl border-t border-base-300 pt-6', {
            children: [el('p', '', { text: '© Acme' })],
          }),
        ],
      }),
    ],
  });

describe('the captured golden frame', () => {
  it('puts the full-width bar into the house measure, children and attributes kept', () => {
    const nav = (capturedFrame() as Element).children![0] as Element;
    expect(isCapturedHeader(nav)).toBe(true);
    const healed = headerToInsideMeasure(nav);
    expect(healed.attrs).toEqual({ 'aria-label': 'Primary' });
    expect(healed.class).toBe('@container border-b border-base-300 bg-base-100');
    const box = healed.children![0] as Element;
    expect(box.children).toEqual(nav.children);
    expectHouseEdge(healed, 'captured header');
  });

  it('upgradeFrameChrome lines the header and the footer up on the house edge', () => {
    const { root, changed } = upgradeFrameChrome(capturedFrame());
    expect(changed).toBe(true);
    const [header, , footer] = (root as Element).children! as Node[];
    expectHouseEdge(header!, 'header');
    expectHouseEdge(footer!, 'footer');
    // And once is enough.
    expect(upgradeFrameChrome(root).changed).toBe(false);
  });

  it('leaves a bar an author restyled alone', () => {
    const restyled = el(
      'nav',
      '@container flex items-center justify-between gap-6 border-b border-base-300 bg-primary px-6 py-4'
    );
    expect(isCapturedHeader(restyled)).toBe(false);
  });
});
