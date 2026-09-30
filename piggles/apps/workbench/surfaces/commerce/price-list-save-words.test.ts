import { describe, expect, it } from 'vitest';

import { createdWithoutPrices, saveFailureLine } from './price-list-save-words';

describe('saveFailureLine', () => {
  it('says nothing changed only when nothing was written', () => {
    expect(saveFailureLine('settings', 0)).toBe(
      'Could not save this special price. Nothing was changed.'
    );
    expect(saveFailureLine('settings', 3)).toBe(
      'Could not save this special price. Nothing was changed.'
    );
  });

  it('never says nothing changed once the settings have committed', () => {
    for (const point of ['removals', 'prices'] as const) {
      for (const removed of [0, 1, 4]) {
        expect(saveFailureLine(point, removed)).not.toContain('Nothing was changed');
      }
    }
  });

  it('says the settings are saved when the prices are the part that failed', () => {
    expect(saveFailureLine('prices', 0)).toContain('The list itself was saved');
    expect(saveFailureLine('removals', 0)).toContain('The list itself was saved');
  });

  it('warns that removed prices are already gone, and counts them', () => {
    expect(saveFailureLine('prices', 1)).toContain('The price you took off the list has already');
    expect(saveFailureLine('prices', 4)).toContain('The 4 prices you took off the list have');
  });

  it('says nothing about removals when there were none', () => {
    expect(saveFailureLine('prices', 0)).not.toContain('took off');
    expect(saveFailureLine('removals', 0)).not.toContain('took off');
  });

  it('tells her nothing was lost only where that is true', () => {
    // After the prices call failed, the editor still holds everything she typed,
    // so saving again is the whole fix. A failure DURING the removals leaves the
    // list half-cleared, so it asks her to look first.
    expect(saveFailureLine('prices', 0)).toContain('Nothing you typed has been lost');
    expect(saveFailureLine('removals', 0)).not.toContain('Nothing you typed has been lost');
    expect(saveFailureLine('removals', 0)).toContain('Check the prices below');
  });

  it('ends every line with a full stop', () => {
    for (const point of ['settings', 'removals', 'prices'] as const) {
      for (const removed of [0, 1, 2]) {
        expect(saveFailureLine(point, removed).endsWith('.')).toBe(true);
      }
    }
  });
});

describe('createdWithoutPrices', () => {
  it('names the list and does not call it a plain success', () => {
    const line = createdWithoutPrices('Trade sheet 2026', 3);
    expect(line).toContain('Trade sheet 2026');
    expect(line).toContain('could not be saved');
  });

  it('counts the prices, and reads right for one', () => {
    expect(createdWithoutPrices('Wholesale', 1)).toBe(
      'Wholesale was created, but its price could not be saved. Add it again on the list.'
    );
    expect(createdWithoutPrices('Wholesale', 5)).toBe(
      'Wholesale was created, but its 5 prices could not be saved. Add them again on the list.'
    );
  });
});
