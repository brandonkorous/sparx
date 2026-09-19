import { describe, expect, it } from 'vitest';
import { wordForms } from './word-forms';
import { score, type Entry } from './launcher-match';

/** A surface row, shaped the way the launcher builds one from the registry. */
function surface(label: string, group = 'Stock', keywords: string[] = []): Entry {
  return { id: `surface:${label}`, group, label, keywords, run: () => undefined };
}

describe('the other spelling of a word', () => {
  it('reaches a screen whose name is the plural of what was typed', () => {
    // Measured as P03: typing "shelf" into the launcher offered "Shelf labels"
    // and "Expiring stock", and NOT "Shelves" — the screen actually called
    // shelves, one row away in the same app.
    expect(score(surface('Shelves'), 'shelf')).toBeGreaterThan(0);
    expect(score(surface('Categories'), 'category')).toBeGreaterThan(0);
    expect(score(surface('Companies'), 'company')).toBeGreaterThan(0);
    expect(score(surface('Quick replies'), 'reply')).toBeGreaterThan(0);
    expect(score(surface('Spending categories'), 'category')).toBeGreaterThan(0);
  });

  it('reaches a screen whose name is the singular of what was typed', () => {
    // The same person may type either, whichever way round the screen is named.
    expect(score(surface('Shelf labels'), 'shelves')).toBeGreaterThan(0);
    expect(score(surface('Every change'), 'changes')).toBeGreaterThan(0);
  });

  it('ranks the screen that IS the word above one that merely mentions it', () => {
    // "shelf" must not reach Shelves in a way that puts it under Shelf labels:
    // the plural of the typed word is the same word, so it takes the top rung.
    expect(score(surface('Shelves'), 'shelf')).toBeGreaterThan(
      score(surface('Shelf labels'), 'shelf')
    );
  });

  it('leaves every ranking that already worked exactly where it was', () => {
    // 272 of the 287 plural words in screen names already matched by accident,
    // because "orders" contains "order". None of them may move.
    expect(score(surface('Orders'), 'orders')).toBe(100);
    expect(score(surface('Orders'), 'order')).toBe(100); // was 80: same word
    expect(score(surface('Moving stock'), 'moving')).toBe(80);
    expect(score(surface('Every change'), 'change')).toBe(60);
    expect(score(surface('At risk', 'Stock', ['stockout']), 'invoice')).toBe(0);
  });

  it('still refuses a word that is only a coincidence inside another', () => {
    // The ladder's own rule: "sale" must not be matched by "wholesale" as if it
    // were a name. Adding spellings must not quietly turn that back on.
    expect(score(surface('Wholesale'), 'sale')).toBeLessThan(score(surface('Sales'), 'sale'));
  });

  it('never makes a form short enough to appear inside an unrelated word', () => {
    // "bus" → "bu" would reach "budget". No form is INVENTED under three
    // letters. What somebody typed is always kept, however short, because a
    // search box must look for the thing it was given.
    for (const word of ['bus', 'is', 'as', 'gas']) {
      expect(wordForms(word)[0]).toBe(word);
      for (const made of wordForms(word).slice(1)) expect(made.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('does not chop a singular word that merely ends in s', () => {
    expect(wordForms('status')).not.toContain('statu');
    expect(wordForms('press')).not.toContain('pres');
    expect(wordForms('address')).not.toContain('addres');
  });

  it('keeps what was typed first, so nothing is rewritten behind anyone', () => {
    expect(wordForms('shelf')[0]).toBe('shelf');
    expect(wordForms('Shelves')[0]).toBe('shelves');
  });
});
