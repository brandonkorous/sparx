// The translation between an authored HTML attribute and the React prop the walk
// hands to `createElement`.
//
// The case that matters is the one where the two spellings AGREE and the meanings
// do not: HTML's `value` is where a control starts, React's `value` is what it is
// pinned to. Get that wrong and the page renders perfectly, reads correctly, and
// cannot be typed into.

import { describe, expect, it } from 'vitest';
import { attrProps, reactAttrName, uncontrolledProp } from './silica-attrs';

describe('a form control starts at its authored value and stays editable', () => {
  it('hands React the UNCONTROLLED spelling for a text-ish input', () => {
    // The whole of issue 371 is this one line. As `value`, the quantity box in a
    // live buy box was frozen at 1 — typing, the spinner arrows and the up-arrow
    // key all did nothing, and no customer could buy two of anything.
    expect(attrProps('input', { type: 'number', name: 'quantity', value: '1' })).toMatchObject({
      defaultValue: '1',
      name: 'quantity',
    });
  });

  it('does not leave a bare `value` behind for React to control', () => {
    expect(attrProps('input', { type: 'text', value: 'Devi' })).not.toHaveProperty('value');
  });

  it('does the same for a checkbox that starts ticked', () => {
    expect(attrProps('input', { type: 'checkbox', name: 'gift', checked: true })).toMatchObject({
      defaultChecked: true,
    });
  });
});

describe('a radio or checkbox keeps its `value`', () => {
  // There it is the payload the form submits, not the state of the control —
  // React neither freezes it nor complains, and the variant picker on every
  // product page depends on the submitted value being exactly this.
  for (const type of ['radio', 'checkbox']) {
    it(`leaves ${type} value alone`, () => {
      const props = attrProps('input', { type, name: 'variantId', value: 'var_123' });
      expect(props.value).toBe('var_123');
      expect(props).not.toHaveProperty('defaultValue');
    });
  }

  it('still remaps its checked, which IS the state', () => {
    expect(uncontrolledProp('input', 'checked', { type: 'radio' })).toBe('defaultChecked');
  });
});

describe('only form controls are touched', () => {
  it('leaves an option value alone, where React does not control it', () => {
    expect(attrProps('option', { value: 'sales' })).toMatchObject({ value: 'sales' });
  });

  it('leaves a non-form tag alone entirely', () => {
    expect(uncontrolledProp('li', 'value', undefined)).toBeUndefined();
  });
});

describe('names React spells differently are remapped', () => {
  const remaps: [string, string][] = [
    ['tabindex', 'tabIndex'],
    ['for', 'htmlFor'],
    ['readonly', 'readOnly'],
    ['maxlength', 'maxLength'],
    ['autocomplete', 'autoComplete'],
    ['datetime', 'dateTime'],
  ];

  for (const [html, react] of remaps) {
    it(`${html} → ${react}`, () => {
      expect(reactAttrName(html)).toBe(react);
    });
  }
});

describe('hyphenated names split three ways', () => {
  it('passes data- and aria- through verbatim', () => {
    expect(reactAttrName('data-icon')).toBe('data-icon');
    expect(reactAttrName('aria-label')).toBe('aria-label');
  });

  it('camelCases every other hyphenated name, which is the SVG rule', () => {
    // A pasted brand logo keeps its strokes and gradients instead of filling the
    // console with "Invalid DOM property".
    expect(reactAttrName('stroke-width')).toBe('strokeWidth');
    expect(reactAttrName('clip-path')).toBe('clipPath');
    expect(reactAttrName('dominant-baseline')).toBe('dominantBaseline');
  });

  it('leaves an ordinary name untouched', () => {
    expect(reactAttrName('href')).toBe('href');
  });
});

describe('the security gate still runs first', () => {
  it('drops an attribute silica does not allow on the tag', () => {
    // Translation happens AFTER sanitizing, so nothing reaches React that the
    // engine would not have emitted as HTML.
    expect(
      attrProps('input', { onclick: 'steal()', value: '1', type: 'number' })
    ).not.toHaveProperty('onclick');
  });

  it('survives a node with no attributes at all', () => {
    expect(attrProps('div', undefined)).toEqual({});
  });
});
