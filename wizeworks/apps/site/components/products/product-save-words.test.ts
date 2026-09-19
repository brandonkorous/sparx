import { describe, expect, it } from 'vitest';
import {
  chooseFirstText,
  saveButtonAria,
  saveButtonText,
  variantToSave,
} from './product-save-words';

// 43 shops, 0 saved lists, 0 saved items — because the only control that could
// fill one lived in the previous generation's product body and went out of reach
// when product pages became silica trees (issue 642).

const WORDS = { label: 'Save for later', savedLabel: 'Saved' };

describe('which version gets saved', () => {
  it('never saves a version the shopper is not looking at', () => {
    // Saved items key on a version, so a control that always took the first one
    // would file a size 8 under a shopper looking at the 14.
    expect(variantToSave('size-14', ['size-8', 'size-14'])).toBe('size-14');
    expect(variantToSave('size-8', ['size-8', 'size-14'])).toBe('size-8');
  });

  it('refuses a version this product does not have', () => {
    // A stale form value: the shopper changed color and the radios re-rendered.
    expect(variantToSave('clay-14', ['bone-8', 'bone-14'])).toBeNull();
  });

  it('needs no choice when there is only one version', () => {
    // The buy box renders a hidden field rather than radios, and there is nothing
    // to pick.
    expect(variantToSave(null, ['only-one'])).toBe('only-one');
    expect(variantToSave('', ['only-one'])).toBe('only-one');
  });

  it('waits rather than guessing when several versions and none chosen', () => {
    expect(variantToSave(null, ['size-8', 'size-14'])).toBeNull();
  });

  it('has nothing to save for a product with no versions', () => {
    expect(variantToSave('anything', [])).toBeNull();
    expect(variantToSave(null, [])).toBeNull();
  });
});

describe('what the control says', () => {
  it('says Saved once it is, so the state is readable at rest', () => {
    // Not "Remove": a control naming the undo makes a shopper work out the state
    // by reading the button that changes it.
    expect(saveButtonText(true, WORDS)).toBe('Saved');
    expect(saveButtonText(false, WORDS)).toBe('Save for later');
    expect(saveButtonText(true, WORDS)).not.toContain('Remove');
  });

  it('tells a screen reader the act as well as the state', () => {
    // The visible word is the state; heard alone on a pressable thing it says
    // where you are and not what pressing does.
    expect(saveButtonAria(true, WORDS)).toContain('Saved');
    expect(saveButtonAria(true, WORDS)).toContain('remove');
    expect(saveButtonAria(false, WORDS)).toBe('Save for later');
  });

  it('uses the shop own words when it has some', () => {
    const mine = { label: 'Keep this one', savedLabel: 'Kept' };
    expect(saveButtonText(false, mine)).toBe('Keep this one');
    expect(saveButtonAria(true, mine)).toContain('Kept');
  });

  it('says why it cannot be pressed rather than sitting dead', () => {
    expect(chooseFirstText()).toBe('Choose a version first');
  });
});
