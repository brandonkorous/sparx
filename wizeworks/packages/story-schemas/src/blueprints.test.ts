import { describe, expect, it } from 'vitest';
import { pickBlueprint, type StarterBlueprint } from './blueprints';
import { industryOf } from './clauses';

const EMPTY = { products: 0, pages: 4, content: 0, emails: 0, collections: 0, categories: 0 };
const bp = (
  key: string,
  vertical: StarterBlueprint['vertical'],
  requiresModules: string[],
  pages = 4
) => ({
  key,
  vertical,
  requiresModules,
  contents: { ...EMPTY, pages },
});

// A slice of the real catalog: the services bucket mixes trades, and the
// accounting template is the least content-rich in it.
const CATALOG = [
  bp('sparx-accounting-advisory', 'services', ['builder', 'scheduling', 'crm', 'email'], 3),
  bp('sparx-fitness-bold', 'services', ['builder', 'scheduling', 'crm', 'email'], 6),
  bp('sparx-yoga-studio', 'services', ['builder', 'scheduling', 'crm', 'email'], 7),
  bp('sparx-salon-modern', 'services', ['builder', 'scheduling', 'crm', 'email'], 5),
  bp('sparx-b2b-industrial-supply', 'b2b', ['builder', 'commerce', 'cms', 'crm', 'email'], 8),
  bp('sparx-catalog-dense', 'retail', ['builder', 'commerce', 'cms', 'crm', 'email'], 9),
];

const FITNESS_ON = { builder: true, commerce: true, crm: true, email: true, scheduling: true };

describe('pickBlueprint', () => {
  it("gives a fitness studio a fitness template, not the bucket's least-content one", () => {
    expect(pickBlueprint(industryOf('fitness'), FITNESS_ON, CATALOG)?.key).toBe(
      'sparx-fitness-bold'
    );
  });

  it('starts blank rather than hand over another trade’s template', () => {
    const noFitness = CATALOG.filter((b) => !/fitness|yoga/.test(b.key));
    expect(pickBlueprint(industryOf('fitness'), FITNESS_ON, noFitness)).toBeNull();
  });

  it('never picks a template that needs a module the owner did not turn on', () => {
    const onlyB2b = { builder: true, commerce: true, crm: true, b2b: true };
    expect(pickBlueprint(industryOf('wholesale'), onlyB2b, CATALOG)).toBeNull();
    expect(
      pickBlueprint(industryOf('wholesale'), { ...onlyB2b, cms: true, email: true }, CATALOG)?.key
    ).toBe('sparx-b2b-industrial-supply');
  });

  it('gives a parts shop that sells online the parts template, not a repair-only one', () => {
    // sparx persona issue 013, the real catalog rows for auto parts.
    const auto = [
      bp('sparx-auto-euro', 'services', ['builder', 'scheduling', 'crm', 'email'], 4),
      bp('sparx-auto-neighborhood', 'services', ['builder', 'scheduling', 'crm', 'email'], 4),
      bp('sparx-garage', 'services', ['builder', 'commerce', 'cms', 'crm', 'email'], 7),
    ];
    const gillett = { ...FITNESS_ON, cms: true, b2b: true, inventory: true };
    expect(pickBlueprint(industryOf('auto-parts'), gillett, auto)?.key).toBe('sparx-garage');
  });

  it('with no industry chosen, still falls back to the vertical match', () => {
    const shop = { builder: true, commerce: true, cms: true, crm: true, email: true };
    expect(pickBlueprint(null, shop, CATALOG)?.key).toBe('sparx-catalog-dense');
  });
});
