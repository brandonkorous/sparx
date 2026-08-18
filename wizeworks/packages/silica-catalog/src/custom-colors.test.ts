import { describe, expect, it } from 'vitest';
import { SEMANTIC_ROLES, type Theme } from '@wizeworks/silicaui-html';

import { BASE_SILICA_THEME } from './base-theme';
import { SPARX_RESIDUAL_COLOR_ROLES } from './resolve-sparx-theme';
import {
  SPARX_REGISTERED_COLOR_ROLES,
  buildCustomColorCss,
  buildDerivedContentCss,
  customColorRoles,
  customColorRuleCss,
} from './custom-colors';

/** The base theme plus one author-invented color, the shape `addColor` writes. */
function withCustom(tokens: Record<string, string>, dark?: Record<string, string>): Theme {
  return {
    ...BASE_SILICA_THEME,
    tokens: { ...BASE_SILICA_THEME.tokens, ...tokens },
    ...(dark ? { dark: { ...BASE_SILICA_THEME.dark, ...dark } } : {}),
  };
}

describe('customColorRoles', () => {
  it('finds an author-added color and ignores the semantic roles', () => {
    const theme = withCustom({ '--color-sunset': '#e04631' });
    expect(customColorRoles(theme)).toEqual(['sunset']);
  });

  it('is empty for a theme nobody added a color to', () => {
    expect(customColorRoles(BASE_SILICA_THEME)).toEqual([]);
  });

  it('never returns a semantic role, a surface token, or a -content pair', () => {
    const roles = customColorRoles(
      withCustom({ '--color-brand': '#123456', '--color-brand-content': '#fff' })
    );
    expect(roles).toEqual(['brand']);
    for (const semantic of SEMANTIC_ROLES) expect(roles).not.toContain(semantic);
  });

  // The regression that motivated `registered`: silicaui knows eight roles, and a
  // stock sparx theme carries three more. Reading `rolesOf` against SEMANTIC_ROLES
  // alone reported danger/highlight/border as author-invented on EVERY site.
  it.each(SPARX_RESIDUAL_COLOR_ROLES)('treats the sparx residual %s as registered', (role) => {
    expect(SPARX_REGISTERED_COLOR_ROLES).toContain(role);
    expect(customColorRoles(BASE_SILICA_THEME)).not.toContain(role);
  });

  it('honours a caller whose plugin colors list differs', () => {
    const theme = withCustom({ '--color-brand': '#123456' });
    expect(customColorRoles(theme, [...SPARX_REGISTERED_COLOR_ROLES, 'brand'])).toEqual([]);
  });

  it('sorts and de-dupes so the memo key is insertion-order independent', () => {
    const a = customColorRoles(withCustom({ '--color-zinc': '#111', '--color-amber': '#fb0' }));
    const b = customColorRoles(withCustom({ '--color-amber': '#fb0', '--color-zinc': '#111' }));
    expect(a).toEqual(['amber', 'zinc']);
    expect(a).toEqual(b);
  });

  // theme.tokens is stored opaquely (SilicaThemeInput is a loose z.record), and a
  // role name is interpolated into a CSS SELECTOR — so a name that can't be one is
  // dropped rather than escaped.
  it.each([
    ['--color-x{}body{display:none}', 'a selector break-out'],
    ['--color-UPPER', 'a non-slug name'],
    ['--color--leading', 'a leading dash'],
    ['--color-has space', 'whitespace'],
    [`--color-${'a'.repeat(64)}`, 'an over-long name'],
  ])('rejects %s (%s)', (key) => {
    expect(customColorRoles(withCustom({ [key]: 'red' }))).toEqual([]);
  });
});

describe('customColorRuleCss', () => {
  const css = customColorRuleCss(['brand']);

  it('is empty when there is nothing custom', () => {
    expect(customColorRuleCss([])).toBe('');
  });

  it('lands in @layer base, where the plugin puts its own component rules', () => {
    expect(css.startsWith('@layer base{')).toBe(true);
  });

  // The whole point: these are the classes a build-time `colors:` entry would have
  // produced. Cover the four families an author is most likely to reach for, plus
  // the utility trio for the color AND its -content.
  it.each([
    '.btn-brand{',
    '.badge-brand{',
    '.alert-brand{',
    '.input-brand{',
    '.tabs-brand{',
    '.text-brand{',
    '.bg-brand{',
    '.border-brand{',
    '.text-brand-content{',
    '.bg-brand-content{',
  ])('emits %s', (selector) => {
    expect(css).toContain(selector);
  });

  it('covers every color-aware component silicaui ships, not just the button', () => {
    // The canvas preview covers 4 selectors; a real registration covers ~41. If a
    // silicaui upgrade drops this sharply, the plugin difference stopped working.
    const selectors = css.match(/\.[a-z][^{]*\{/g) ?? [];
    expect(selectors.length).toBeGreaterThan(30);
  });

  it('paints nothing outside the three color utilities', () => {
    // A component variant must be a pure var-setter — it feeds the static `.btn` /
    // `.badge` rules rather than competing with them. The utility trio is the one
    // exception (`.text-x` really does set `color`), exactly as at build time.
    const paints = new Set(['color', 'background-color', 'border-color']);
    const body = css.slice('@layer base{'.length, -1);
    for (const rule of body.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
      const selector = (rule[1] ?? '').trim();
      const isUtility = /^\.(text|bg|border)-brand(-content)?$/.test(selector);
      for (const decl of (rule[2] ?? '').split(';').filter(Boolean)) {
        const prop = decl.slice(0, decl.indexOf(':')).trim();
        if (prop.startsWith('--')) continue;
        expect(isUtility && paints.has(prop), `${selector} { ${decl} }`).toBe(true);
      }
    }
  });

  it('touches nothing belonging to a semantic role or a surface token', () => {
    for (const semantic of SEMANTIC_ROLES) {
      expect(css).not.toContain(`-${semantic}{`);
      expect(css).not.toContain(`var(--color-${semantic})`);
    }
    expect(css).not.toContain(':root');
    expect(css).not.toContain('[data-theme=');
  });

  it('generates independently for each name in a multi-color palette', () => {
    const two = customColorRuleCss(['brand', 'sunset']);
    expect(two).toContain('.btn-brand{');
    expect(two).toContain('.btn-sunset{');
  });

  it('is stable across calls (memoised)', () => {
    expect(customColorRuleCss(['brand'])).toBe(css);
  });
});

describe('buildCustomColorCss', () => {
  it('returns nothing for a theme with no custom color', () => {
    expect(buildCustomColorCss(BASE_SILICA_THEME)).toBe('');
  });

  it('derives the measured -content the author never typed', () => {
    const css = buildCustomColorCss(withCustom({ '--color-sunset': '#e04631' }));
    expect(css).toContain(':root{--color-sunset-content:');
    expect(css).toContain('.btn-sunset{');
  });

  it('leaves an authored -content alone', () => {
    const css = buildCustomColorCss(
      withCustom({ '--color-sunset': '#e04631', '--color-sunset-content': '#000000' })
    );
    expect(css).not.toContain('--color-sunset-content:');
  });

  it('carries the dark ramp on the same selectors the theme file uses', () => {
    const css = buildCustomColorCss(
      withCustom({ '--color-sunset': '#e04631' }, { '--color-sunset': '#ffd7cf' })
    );
    expect(css).toContain(':root[data-theme="dark"]{');
    expect(css).toContain('@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){');
  });

  it('omits a dark block for a color the author left the same in dark mode', () => {
    // The theme HAS a dark ramp (base/primary/… shift) but sunset does not, so its
    // ink is unchanged and repeating it would be three copies of one value.
    const css = buildCustomColorCss(withCustom({ '--color-sunset': '#e04631' }, {}));
    expect(css).toContain(':root{--color-sunset-content:');
    expect(css).not.toContain('[data-theme="dark"]');
  });

  it('honours a scoped root selector, for a preview surface', () => {
    const css = buildCustomColorCss(withCustom({ '--color-sunset': '#e04631' }), {
      rootSelector: '.tp-demo',
    });
    expect(css).toContain('.tp-demo{--color-sunset-content:');
  });

  it('never lets a token VALUE terminate the block', () => {
    const css = buildCustomColorCss(withCustom({ '--color-sunset': 'red}body{display:none' }));
    // The derived -content is dropped rather than emitted; the component rules,
    // which only reference the var by name, still ship.
    expect(css).not.toContain('display:none');
    expect(css).toContain('.btn-sunset{');
  });
});

describe('buildDerivedContentCss across light and dark', () => {
  /** The ordinary shape: the ink is decided once in light, and only the COLOR is
   *  restated for dark. */
  const inkInLightColorInDark: Theme = {
    name: 'probe',
    tokens: {
      '--color-base-100': '#ffffff',
      '--color-base-content': '#111111',
      '--color-primary': '#1d4ed8',
      '--color-primary-content': '#ffffff',
    },
    dark: {
      '--color-base-100': '#111111',
      '--color-base-content': '#eeeeee',
      '--color-primary': '#bfdbfe',
    },
  };

  it('re-derives an ink the dark bag has moved the color out from under', () => {
    const css = buildDerivedContentCss(inkInLightColorInDark);
    const dark = css.slice(css.indexOf(':root[data-theme="dark"]'));

    // White on #bfdbfe measures 1.42:1. Emitting nothing here left exactly that
    // on every filled surface in the theme.
    expect(dark).toContain('--color-primary-content:');
    expect(dark).not.toContain('#ffffff');
  });

  it('leaves the light ink exactly as authored', () => {
    const css = buildDerivedContentCss(inkInLightColorInDark);
    const light = css.slice(0, css.indexOf(':root[data-theme="dark"]'));
    expect(light).not.toContain('--color-primary-content:');
  });

  it('says nothing in dark for a role the dark bag does not touch', () => {
    const css = buildDerivedContentCss({
      name: 'probe',
      tokens: { '--color-primary': '#1d4ed8', '--color-success': '#15803d' },
      dark: { '--color-primary': '#bfdbfe' },
    });
    const dark = css.slice(css.indexOf(':root[data-theme="dark"]'));
    expect(dark).toContain('--color-primary-content:');
    expect(dark).not.toContain('--color-success-content:');
  });

  it('is silent where the theme authored the pair in both modes', () => {
    const css = buildDerivedContentCss({
      name: 'probe',
      tokens: { '--color-primary': '#1d4ed8', '--color-primary-content': '#ffffff' },
      dark: { '--color-primary': '#bfdbfe', '--color-primary-content': '#0b1220' },
    });
    expect(css).toBe('');
  });
});
