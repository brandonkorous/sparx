import { describe, expect, it } from 'vitest';
import {
  el,
  THEME_PRESETS,
  type ElementNode,
  type Node,
  type Theme,
} from '@wizeworks/silicaui-html';

import { lintSite } from './index';
import type { LintRuleId, SiteLintInput } from './types';

/* ── A theme with a known answer for every case under test ──────────────────── */

const THEME: Theme = {
  name: 'test',
  mode: 'light',
  tokens: {
    '--color-base-100': '#ffffff',
    '--color-base-200': '#f4f4f5',
    '--color-base-300': '#d4d4d8',
    '--color-base-content': '#18181b',
    // Dark blue — the derived foreground is white, and it clears AA comfortably.
    '--color-primary': '#1d4ed8',
    // Mid grey with an AUTHORED foreground that is too close in tone (~3.6:1) — a pair
    // the owner chose, which is the realistic way a theme pair fails now.
    //
    // It used to carry no `-content` and rely on the DERIVED ink being wrong, which
    // stopped being a real failure when the threshold moved to 0.57: the derivation
    // picks between pure white and pure black, and one of those always clears ~4.58:1,
    // so with the threshold sitting inside the true crossover there is almost no color
    // left where the automatic choice fails. That is the upstream fix working, not a
    // hole in this check — and the derived branch is still reachable, via a theme that
    // overrides the threshold itself (covered below).
    '--color-brand': '#7d7d7d',
    '--color-brand-content': '#efefef',
    // ~3.3:1 against white: fails as body copy, passes as large text.
    '--color-dim': '#8a8a8a',
    // EXACTLY silicaui's content threshold, written in OKLCH — the regression case for
    // reading lightness off the token instead of a round-tripped sRGB value. Tracks the
    // real threshold (0.57 since silicaui 0.36.0); at the old 0.68 this token no longer
    // sat on the boundary at all, so it had quietly stopped guarding anything.
    '--color-edge': 'oklch(57% 0.18 232)',
  },
};

function pageWith(root: Node) {
  return {
    id: 'p1',
    name: 'Home',
    slug: '/',
    root,
    seoTitle: 'Home',
    seoDescription: 'A page.',
  };
}

/** A body carrying one h1 so the heading rules stay quiet. */
function body(...children: Node[]): ElementNode {
  return el('main', '', { children: [el('h1', '', { text: 'Title' }), ...children] });
}

function rules(root: Node, theme: Theme | null = THEME): LintRuleId[] {
  const input: SiteLintInput = { pages: [pageWith(root)], theme };
  return lintSite(input).findings.map((f) => f.rule);
}

function colorFindings(root: Node, theme: Theme | null = THEME) {
  return lintSite({ pages: [pageWith(root)], theme }).findings.filter((f) =>
    f.rule.startsWith('contrast-')
  );
}

/* ── The theme's own pairs ──────────────────────────────────────────────────── */

describe("the theme's own color pairs", () => {
  it('flags a color the site paints with whose text color does not carry', () => {
    const found = colorFindings(
      body(el('div', 'bg-brand text-brand-content', { text: 'On brand' }))
    );
    expect(found).toHaveLength(1);
    expect(found[0]?.rule).toBe('contrast-low');
    expect(found[0]?.location.scope).toBe('site');
    expect(found[0]?.evidence).toContain('brand');
  });

  it("reports the theme's own pair once, not again on every element using it", () => {
    // `bg-brand text-brand-content` IS the theme pair spelled out. Reporting it a
    // second time per element would attach the wrong fix to it.
    const many = body(
      el('div', 'bg-brand text-brand-content', { text: 'One' }),
      el('div', 'bg-brand text-brand-content', { text: 'Two' }),
      el('div', 'bg-brand text-brand-content', { text: 'Three' })
    );
    const found = colorFindings(many);
    expect(found).toHaveLength(1);
    expect(found[0]?.location.scope).toBe('site');
  });

  it('says nothing about a color the site never paints with', () => {
    // `brand` is in the theme and is bad, but nothing uses it as a surface.
    expect(
      colorFindings(body(el('div', 'bg-primary text-primary-content', { text: 'Hi' })))
    ).toEqual([]);
  });

  it('counts a component variant as painting with the color', () => {
    const found = colorFindings(
      body(el('a', 'btn btn-brand', { attrs: { href: '/' }, text: 'Go' }))
    );
    expect(found.map((f) => f.rule)).toContain('contrast-low');
  });

  it('reads lightness off the token, not off a round-tripped colour', () => {
    // `oklch(57% …)` sits exactly ON silicaui's threshold, and the CSS `clamp` resolves
    // the boundary to the DARK ink, which reads at 5.2:1. Round-tripping the lightness
    // through sRGB instead returns 0.5698 — a thousandth under — takes WHITE, and reports
    // 4.1:1 on a legible colour. One rounding error, one wrong verdict.
    //
    // The pair is spelled out because `bg-edge` ALONE would not exercise the derivation
    // at all: a background class does not set a text color, so the words inside inherit
    // `--color-base-content`. The derived ink only paints where something asks for it —
    // `text-edge-content`, or a component variant like `btn-edge`.
    expect(colorFindings(body(el('div', 'bg-edge text-edge-content', { text: 'Edge' })))).toEqual(
      []
    );
  });

  it('flags a DERIVED pair when the theme moves the threshold itself', () => {
    // The derived branch is near-unreachable at the default threshold, but a theme may
    // set `--silica-content-threshold`, and that moves every automatic foreground on the
    // site with it. Pushing it back to the old 0.68 makes the derivation pick WHITE for a
    // mid grey again — precisely the class of bug 0.36.0 removed, still available to
    // anyone who asks for it.
    const { '--color-brand-content': _authored, ...rest } = THEME.tokens;
    const moved: Theme = {
      ...THEME,
      // No authored `-content` for brand, so the derivation decides.
      tokens: { ...rest, '--silica-content-threshold': '0.68' },
    };

    const found = colorFindings(
      body(el('div', 'bg-brand text-brand-content', { text: 'On' })),
      moved
    );
    // Two findings, at two scopes, and both are right: the theme pair itself is bad, and
    // so is this element that uses it. Only the site-scoped one is this rule's business.
    const pair = found.filter((f) => f.location.scope === 'site');
    expect(pair).toHaveLength(1);
    expect(pair[0]?.detail).toContain('picked automatically');
    expect(pair[0]?.evidence).toContain('brand');
  });
});

/* ── The author's own pairings ──────────────────────────────────────────────── */

describe("the author's own pairings", () => {
  it('flags near-invisible text as an error', () => {
    const found = colorFindings(body(el('p', 'text-base-300', { text: 'Fine print' })));
    expect(found).toHaveLength(1);
    expect(found[0]?.rule).toBe('contrast-unreadable');
    expect(found[0]?.severity).toBe('error');
    expect(found[0]?.evidence).toContain('Fine print');
  });

  it('accepts the default ink on the default surface', () => {
    expect(colorFindings(body(el('p', '', { text: 'Ordinary copy' })))).toEqual([]);
  });

  it('holds body copy to 4.5:1 and large text to 3:1', () => {
    const small = colorFindings(body(el('p', 'text-dim', { text: 'Body copy' })));
    expect(small.map((f) => f.rule)).toEqual(['contrast-low']);

    const large = colorFindings(body(el('p', 'text-dim text-4xl', { text: 'Big statement' })));
    expect(large).toEqual([]);
  });

  it('inherits the background and the text colour from ancestors', () => {
    const nested = body(
      el('section', 'bg-primary', {
        children: [el('div', '', { children: [el('p', '', { text: 'Inherited ink' })] })],
      })
    );
    // The default ink (#18181b) on primary (#1d4ed8) — dark on dark.
    expect(colorFindings(nested).map((f) => f.rule)).toContain('contrast-unreadable');
  });

  it('judges only the node holding the words, not every wrapper around it', () => {
    const nested = body(
      el('section', 'bg-primary', {
        children: [
          el('div', '', {
            children: [el('div', '', { children: [el('p', '', { text: 'Once' })] })],
          }),
        ],
      })
    );
    expect(colorFindings(nested)).toHaveLength(1);
  });

  it('computes the soft tint rather than treating it as the solid colour', () => {
    // `bg-soft` paints 15% of primary over base-100 — a very pale blue. White text
    // chosen for solid primary disappears on it; primary text reads fine.
    const wrong = body(
      el('div', 'bg-primary bg-soft', {
        children: [el('p', 'text-primary-content', { text: 'On a tint' })],
      })
    );
    expect(colorFindings(wrong).map((f) => f.rule)).toContain('contrast-unreadable');

    const right = body(
      el('div', 'bg-primary bg-soft', {
        children: [el('p', 'text-primary', { text: 'On a tint' })],
      })
    );
    expect(colorFindings(right)).toEqual([]);
  });

  it('declines to judge a component painting its own surface', () => {
    // A `.badge` paints base-100 from silicaui's base layer, so inheriting the dark
    // section behind it would be inventing a failure.
    const card = body(
      el('section', 'bg-primary', {
        children: [el('span', 'badge', { text: 'New' })],
      })
    );
    expect(colorFindings(card)).toEqual([]);
  });

  it('declines to judge text behind an opacity modifier', () => {
    expect(colorFindings(body(el('p', 'text-base-content/40', { text: 'Faded' })))).toEqual([]);
  });

  it('lets an explicit background override a component surface', () => {
    const card = body(el('div', 'card bg-primary', { children: [el('p', '', { text: 'Dark' })] }));
    expect(colorFindings(card).map((f) => f.rule)).toContain('contrast-unreadable');
  });
});

/* ── Modes ──────────────────────────────────────────────────────────────────── */

describe('modes', () => {
  const dual: Theme = {
    ...THEME,
    dark: {
      '--color-base-100': '#111111',
      // Left as the light value on purpose: near-black ink on a near-black surface.
      '--color-base-content': '#18181b',
    },
  };

  it('checks dark mode too, and says which mode it means', () => {
    // Both the heading and the paragraph inherit the ink, so both fail — and both
    // fail ONLY in dark, which is the point: light mode is fine.
    const found = colorFindings(body(el('p', '', { text: 'Copy' })), dual);
    expect(found).toHaveLength(2);
    expect(found.every((f) => f.rule === 'contrast-unreadable')).toBe(true);
    expect(found.every((f) => f.evidence?.includes('dark'))).toBe(true);
    expect(found[0]?.detail).toContain('dark mode');
  });

  it('does not name a mode on a theme that has only one', () => {
    const found = colorFindings(body(el('p', 'text-base-300', { text: 'Copy' })));
    expect(found[0]?.detail).not.toContain('light mode');
  });
});

/* ── Refusals ───────────────────────────────────────────────────────────────── */

describe('without a theme', () => {
  it('returns no colour findings at all rather than assuming a palette', () => {
    const found = colorFindings(body(el('p', 'text-base-300', { text: 'Fine print' })), null);
    expect(found).toEqual([]);
  });

  it('leaves every other rule working', () => {
    expect(rules(el('main', ''), null)).toContain('page-empty');
  });
});

/* ── The shipped presets, as a regression ───────────────────────────────────── */

describe('silicaui preset themes', () => {
  it('parses every token in every preset', () => {
    // A preset writes OKLCH. If `parseColor` ever stops handling it, every colour
    // reads as black and the whole check turns into noise — so assert the palette
    // resolves rather than trusting that no findings means no problems.
    for (const theme of THEME_PRESETS) {
      const found = colorFindings(
        body(
          el('div', 'bg-base-100', { children: [el('p', 'text-base-content', { text: 'x' })] }),
          el('div', 'bg-base-200', { children: [el('p', '', { text: 'y' })] })
        ),
        theme
      );
      // The base ink on the base surfaces is the one pairing every shipped preset
      // gets right by construction. If OKLCH ever stops parsing, every colour reads
      // as black, and THIS is what starts failing.
      expect(found.filter((f) => f.location.scope === 'page')).toEqual([]);
    }
  });
});
