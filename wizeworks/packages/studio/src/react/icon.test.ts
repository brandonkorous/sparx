// Every glyph the editor asks for must draw. "Move up" and "Move down" were blank
// squares in both consoles: the baked set has no up or down arrow (persona issue 947).

import { describe, expect, it } from 'vitest';

import { bakedIcon } from './icon';

describe('bakedIcon', () => {
  it('draws up and down from the side arrows, turned', () => {
    expect(bakedIcon('arrow-up')).toMatchObject({ turn: 'rotate-90' });
    expect(bakedIcon('arrow-up')?.markup).toContain('<svg');
    expect(bakedIcon('arrow-down')?.markup).toContain('<svg');
  });

  it('draws every name the Inspector and toolbars ask for', () => {
    for (const name of [
      'arrow-up',
      'arrow-down',
      'copy',
      'trash',
      'check',
      'info',
      'plus',
      'undo',
      'redo',
      'menu',
    ]) {
      expect(bakedIcon(name), name).not.toBeNull();
    }
  });
});
