import { describe, it, expect } from 'vitest';
import { SectionTemplate, type TemplateNode } from './section-template';
import { fieldSpecToZod } from './field-spec-to-zod';
import { validateTemplate } from './section-template-validate';
import type { SectionField } from './fields';

// The worked example from the handoff spec: a `custom:icon-grid` section.
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
  type: 'Stack',
  gap: 'lg',
  children: [
    {
      type: 'If',
      test: { $exists: 'field.heading' },
      children: [{ type: 'Heading', level: 2, text: { $bind: 'field.heading' } }],
    },
    {
      type: 'Grid',
      cols: { $bind: 'field.columns' },
      gap: 'lg',
      children: [
        {
          type: 'Repeater',
          each: 'items',
          children: [
            {
              type: 'Stack',
              gap: 'sm',
              children: [
                { type: 'Icon', name: { $bind: 'item.icon' }, size: 'lg', tone: 'accent' },
                { type: 'Heading', level: 3, text: { $bind: 'item.title' } },
                { type: 'Text', text: { $bind: 'item.body' }, tone: 'secondary' },
              ],
            },
          ],
        },
      ],
    },
  ],
};

describe('section template AST', () => {
  it('parses the worked icon-grid example', () => {
    expect(SectionTemplate.safeParse(ICON_GRID_TEMPLATE).success).toBe(true);
  });

  it('rejects an unknown node type', () => {
    expect(SectionTemplate.safeParse({ type: 'Marquee' }).success).toBe(false);
  });

  it('rejects an off-enum styleable prop', () => {
    expect(SectionTemplate.safeParse({ type: 'Stack', gap: 'huge' }).success).toBe(false);
  });

  it('rejects unknown props (strict objects)', () => {
    expect(
      SectionTemplate.safeParse({ type: 'Heading', text: 'Hi', onClick: 'doEvil()' }).success
    ).toBe(false);
  });

  it('accepts literal, $bind, and $concat value expressions', () => {
    expect(SectionTemplate.safeParse({ type: 'Text', text: 'Plain' }).success).toBe(true);
    expect(SectionTemplate.safeParse({ type: 'Text', text: { $bind: 'field.x' } }).success).toBe(
      true
    );
    expect(
      SectionTemplate.safeParse({
        type: 'Text',
        text: { $concat: ['From ', { $bind: 'field.price', format: 'money' }, '/mo'] },
      }).success
    ).toBe(true);
  });

  it('rejects an unknown value formatter', () => {
    expect(
      SectionTemplate.safeParse({ type: 'Text', text: { $bind: 'field.x', format: 'rot13' } })
        .success
    ).toBe(false);
  });
});

describe('validateTemplate (semantic checks)', () => {
  it('passes the worked icon-grid example', () => {
    expect(validateTemplate(ICON_GRID_TEMPLATE, { fieldSpec: ICON_GRID_FIELDS })).toEqual([]);
  });

  it('flags a $bind to an undeclared field', () => {
    const tpl: TemplateNode = { type: 'Heading', text: { $bind: 'field.nope' } };
    const issues = validateTemplate(tpl, { fieldSpec: ICON_GRID_FIELDS });
    expect(issues).toHaveLength(1);
    expect(issues[0]?.message).toContain('nope');
  });

  it('flags `item.*` used outside a Repeater', () => {
    const tpl: TemplateNode = { type: 'Text', text: { $bind: 'item.title' } };
    const issues = validateTemplate(tpl, { fieldSpec: ICON_GRID_FIELDS });
    expect(issues).toHaveLength(1);
    expect(issues[0]?.message).toContain('Repeater');
  });

  it('flags an unknown item field inside a Repeater', () => {
    const tpl: TemplateNode = {
      type: 'Repeater',
      each: 'items',
      children: [{ type: 'Text', text: { $bind: 'item.subtitle' } }],
    };
    const issues = validateTemplate(tpl, { fieldSpec: ICON_GRID_FIELDS });
    expect(issues.some((i) => i.message.includes('subtitle'))).toBe(true);
  });

  it('flags a Repeater whose `each` is not a list field', () => {
    const tpl: TemplateNode = {
      type: 'Repeater',
      each: 'heading',
      children: [{ type: 'Text', text: 'x' }],
    };
    const issues = validateTemplate(tpl, { fieldSpec: ICON_GRID_FIELDS });
    expect(issues.some((i) => i.path === '(root).each')).toBe(true);
  });

  it('gates `product.*` behind a product binding', () => {
    const tpl: TemplateNode = { type: 'Text', text: { $bind: 'product.title' } };
    expect(validateTemplate(tpl, { fieldSpec: [] })).toHaveLength(1);
    expect(validateTemplate(tpl, { fieldSpec: [], binding: 'product' })).toEqual([]);
  });

  it('rejects an Embed node until the allowlist lands', () => {
    const tpl: TemplateNode = { type: 'Embed', url: 'https://maps.example/x' };
    const issues = validateTemplate(tpl, { fieldSpec: [] });
    expect(issues).toHaveLength(1);
    expect(issues[0]?.message).toContain('Embed');
  });

  it('surfaces structural issues from parsing', () => {
    const issues = validateTemplate({ type: 'Nope' }, { fieldSpec: [] });
    expect(issues.length).toBeGreaterThan(0);
  });
});

describe('fieldSpecToZod', () => {
  const schema = fieldSpecToZod(ICON_GRID_FIELDS);

  it('accepts and defaults a valid config', () => {
    const parsed = schema.parse({
      heading: 'Why fleets choose us',
      columns: '3',
      items: [{ icon: 'wrench', title: 'On-site', body: 'We come to you.' }],
    });
    expect(parsed.heading).toBe('Why fleets choose us');
    expect(parsed.columns).toBe('3');
    expect((parsed.items as unknown[]).length).toBe(1);
  });

  it('fills defaults for a partial config', () => {
    const parsed = schema.parse({});
    expect(parsed.heading).toBe('');
    // select defaults to its first option
    expect(parsed.columns).toBe('2');
    expect(parsed.items).toEqual([]);
  });

  it('rejects an out-of-enum select value', () => {
    expect(() => schema.parse({ columns: '5' })).toThrow();
  });

  it('caps list length at the iteration ceiling', () => {
    const tooMany = Array.from({ length: 51 }, () => ({ icon: 'x', title: 't', body: 'b' }));
    expect(() => schema.parse({ items: tooMany })).toThrow();
  });
});
