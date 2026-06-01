import { describe, it, expect } from 'vitest';
import type { SectionField } from './fields';
import type { TemplateNode } from './section-template';
import {
  CUSTOM_SLUG_MAX,
  customSectionType,
  customSlugOf,
  isCustomSectionType,
  isCustomDefinition,
  toCustomSectionDefinition,
  resolveSectionDefinition,
  parseSectionConfigWith,
  isSectionAllowedInTargetWith,
  customSectionsForTarget,
  mergedSectionsForTarget,
  SectionDefinitionInput,
  SectionFieldSpecSchema,
  type CustomSectionDefinition,
  type CustomSectionRecord,
} from './custom-section';

// The worked example from the handoff spec, reused: a `custom:icon-grid` section.
const ICON_GRID_FIELDS: SectionField[] = [
  { key: 'heading', label: 'Heading', type: 'text' },
  {
    key: 'columns',
    label: 'Columns',
    type: 'select',
    options: [
      { label: 'Two', value: '2' },
      { label: 'Three', value: '3' },
      { label: 'Four', value: '4' },
    ],
  },
  {
    key: 'items',
    label: 'Features',
    type: 'list',
    itemLabel: 'Feature',
    itemFields: [
      { key: 'icon', label: 'Icon', type: 'text' },
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'body', label: 'Text', type: 'textarea' },
    ],
  },
];

const ICON_GRID_TEMPLATE: TemplateNode = {
  type: 'Grid',
  cols: { $bind: 'field.columns' },
  children: [
    {
      type: 'Repeater',
      each: 'items',
      children: [
        {
          type: 'Stack',
          children: [
            { type: 'Icon', name: { $bind: 'item.icon' } },
            { type: 'Heading', level: 3, text: { $bind: 'item.title' } },
          ],
        },
      ],
    },
  ],
};

const ICON_GRID_RECORD: CustomSectionRecord = {
  slug: 'icon-grid',
  label: 'Icon grid',
  description: 'A responsive grid of icon + title features.',
  icon: 'Grid3x3',
  binding: null,
  fieldSpec: ICON_GRID_FIELDS,
  template: ICON_GRID_TEMPLATE,
  version: 1,
};

describe('custom-section namespace', () => {
  it('round-trips a slug through the custom: prefix', () => {
    expect(customSectionType('icon-grid')).toBe('custom:icon-grid');
    expect(isCustomSectionType('custom:icon-grid')).toBe(true);
    expect(isCustomSectionType('hero')).toBe(false);
    expect(customSlugOf('custom:icon-grid')).toBe('icon-grid');
    expect(customSlugOf('hero')).toBeNull();
    expect(customSlugOf('custom:')).toBeNull();
  });

  it('caps the slug so `custom:<slug>` fits the sectionType column (63)', () => {
    expect(CUSTOM_SLUG_MAX).toBe(56);
    expect(customSectionType('a'.repeat(CUSTOM_SLUG_MAX)).length).toBe(63);
  });
});

describe('toCustomSectionDefinition', () => {
  it('builds a registry-shaped definition with a derived config schema', () => {
    const def = toCustomSectionDefinition(ICON_GRID_RECORD);
    expect(def.type).toBe('custom:icon-grid');
    expect(def.custom).toBe(true);
    expect(isCustomDefinition(def)).toBe(true);
    expect(def.fields).toBe(ICON_GRID_FIELDS);
    expect(def.template).toBe(ICON_GRID_TEMPLATE);
    expect(def.binding).toBeUndefined();
    // Derived schema validates + defaults like a code section's schema.
    const parsed = def.schema.parse({}) as Record<string, unknown>;
    expect(parsed.heading).toBe('');
    expect(parsed.columns).toBe('2'); // select defaults to its first option
    expect(parsed.items).toEqual([]);
  });

  it('defaults a missing icon and ignores an invalid binding', () => {
    const def = toCustomSectionDefinition({
      ...ICON_GRID_RECORD,
      icon: null,
      binding: 'nonsense',
    });
    expect(def.icon).toBe('Puzzle');
    expect(def.binding).toBeUndefined();
  });

  it('keeps a valid product/collection binding', () => {
    expect(toCustomSectionDefinition({ ...ICON_GRID_RECORD, binding: 'product' }).binding).toBe(
      'product'
    );
  });
});

describe('custom-aware registry lookups', () => {
  const customDefs: CustomSectionDefinition[] = [toCustomSectionDefinition(ICON_GRID_RECORD)];

  it('resolves code sections and custom sections', () => {
    expect(resolveSectionDefinition('hero', customDefs)?.type).toBe('hero');
    expect(resolveSectionDefinition('custom:icon-grid', customDefs)?.type).toBe('custom:icon-grid');
    expect(resolveSectionDefinition('custom:unknown', customDefs)).toBeUndefined();
    // A custom type with no loaded defs resolves to nothing (forward-compat skip).
    expect(resolveSectionDefinition('custom:icon-grid')).toBeUndefined();
  });

  it('parses a custom config against its derived schema', () => {
    const cfg = parseSectionConfigWith('custom:icon-grid', { heading: 'Why us' }, customDefs);
    expect(cfg.heading).toBe('Why us');
    expect(cfg.columns).toBe('2');
  });

  it('throws on an unknown / unresolved custom type', () => {
    expect(() => parseSectionConfigWith('custom:ghost', {}, customDefs)).toThrow();
    expect(() => parseSectionConfigWith('not-a-section', {})).toThrow();
  });

  it('allows a static custom section in any target', () => {
    expect(isSectionAllowedInTargetWith('custom:icon-grid', 'site:home', customDefs)).toBe(true);
    expect(isSectionAllowedInTargetWith('custom:icon-grid', 'commerce:product', customDefs)).toBe(
      true
    );
  });

  it('gates a bound custom section to a matching target', () => {
    const boundDefs = [toCustomSectionDefinition({ ...ICON_GRID_RECORD, binding: 'product' })];
    expect(isSectionAllowedInTargetWith('custom:icon-grid', 'commerce:product', boundDefs)).toBe(
      true
    );
    expect(isSectionAllowedInTargetWith('custom:icon-grid', 'site:home', boundDefs)).toBe(false);
  });

  it('merges code + custom sections into the target library', () => {
    const merged = mergedSectionsForTarget('site:home', customDefs);
    expect(merged.some((d) => d.type === 'hero')).toBe(true);
    expect(merged.some((d) => d.type === 'custom:icon-grid')).toBe(true);
    expect(customSectionsForTarget('site:home', customDefs)).toHaveLength(1);
  });
});

describe('SectionDefinitionInput', () => {
  const valid = {
    slug: 'icon-grid',
    label: 'Icon grid',
    fieldSpec: ICON_GRID_FIELDS,
    template: ICON_GRID_TEMPLATE,
  };

  it('accepts a well-formed definition', () => {
    expect(SectionDefinitionInput.safeParse(valid).success).toBe(true);
  });

  it('rejects a non-kebab slug', () => {
    expect(SectionDefinitionInput.safeParse({ ...valid, slug: 'Icon Grid' }).success).toBe(false);
    expect(SectionDefinitionInput.safeParse({ ...valid, slug: 'a'.repeat(57) }).success).toBe(false);
  });

  it('rejects an unknown field type in the spec', () => {
    expect(
      SectionFieldSpecSchema.safeParse([{ key: 'x', label: 'X', type: 'rainbow' }]).success
    ).toBe(false);
  });

  it('rejects a structurally invalid template', () => {
    expect(
      SectionDefinitionInput.safeParse({ ...valid, template: { type: 'Marquee' } }).success
    ).toBe(false);
  });
});
