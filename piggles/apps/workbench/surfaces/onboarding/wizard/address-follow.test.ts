// The free web address follows the business name until the owner makes it theirs
// (sparx persona issue 295).

import { describe, expect, it } from 'vitest';
import { addressAfterNameChange } from './address-follow';

describe('addressAfterNameChange', () => {
  it('replaces the placeholder with the name', () => {
    expect(addressAfterNameChange('merry-orchard-1523', '', 'Quiet Bench Repair')).toBe(
      'quiet-bench-repair'
    );
  });

  it('keeps following while she types', () => {
    expect(
      addressAfterNameChange('quiet-bench-repai', 'Quiet Bench Repai', 'Quiet Bench Repair')
    ).toBe('quiet-bench-repair');
  });

  it('never touches an address she typed herself', () => {
    expect(
      addressAfterNameChange('qbr-tools', 'Quiet Bench Repair', 'Quiet Bench Repair & Tools')
    ).toBeNull();
  });

  it('folds accents rather than dropping letters', () => {
    expect(addressAfterNameChange('swift-harbor-3829', '', 'Tomás Café')).toBe('tomas-cafe');
  });

  it('leaves the address alone when the name is cleared', () => {
    expect(addressAfterNameChange('quiet-bench', 'Quiet Bench', '')).toBeNull();
  });

  it('treats the collision fallback as a placeholder too', () => {
    expect(addressAfterNameChange('calm-river-4821-x9k2', '', 'Ridge Co')).toBe('ridge-co');
  });

  it('does not mistake a real three-part address for the placeholder', () => {
    expect(addressAfterNameChange('route-66-diner', '', 'Diner')).toBeNull();
  });
});
