import { describe, expect, it } from 'vitest';
import {
  moneyFieldText,
  optionalMoneyText,
  readCents,
  readMoney,
  readMoneyField,
} from './read-money';

/**
 * WHY THIS FILE EXISTS.
 *
 * A money field is the one place in a console where being nearly right is the
 * same as being wrong. Two separate parsers were reading the amounts people
 * type, and each had half the answer:
 *
 *   • `read-money` knew WHICH of `.` and `,` separated the cents, and then did
 *     `Math.round(Number(x) * 100)` — which reads three decimals low, because
 *     `Number('0.145') * 100` is 14.499999999999998.
 *   • the spending form's own parser did the arithmetic exactly, on a string it
 *     had already stripped every comma out of — so "46,80" became four thousand
 *     six hundred and eighty dollars, and a $46.80 cost was written to the books
 *     as $4,680.00 with no complaint (issue 488).
 *
 * There is now one parser with both halves, and these are the cases that put it
 * there. Removing `exactCents` reddens "a third decimal rounds up"; putting the
 * comma-stripping back reddens "a comma is the cents".
 */
describe('readMoney', () => {
  const cents = (text: string) => {
    const { amount } = readMoney(text, { allowZero: true });
    return amount === null ? null : Math.round(amount * 100);
  };

  it('reads the one spelling everybody agrees on', () => {
    expect(cents('8.50')).toBe(850);
  });

  it('reads a comma as the cents when two digits follow it', () => {
    expect(cents('46,80')).toBe(4680);
    expect(cents('8,50')).toBe(850);
  });

  it('reads a comma as a thousands group when three digits follow it', () => {
    expect(cents('1,250')).toBe(125_000);
  });

  it('reads both marks at once, whichever way round they come', () => {
    expect(cents('1,250.00')).toBe(125_000);
    expect(cents('1.250,00')).toBe(125_000);
  });

  it('ignores the currency somebody typed in front of it', () => {
    expect(cents('$8.00')).toBe(800);
    expect(cents(' 8.00 ')).toBe(800);
  });

  it('rounds a third decimal UP rather than down through a float', () => {
    // Math.round(Number('0.145') * 100) is 14. String arithmetic says 15.
    expect(cents('0.145')).toBe(15);
    expect(cents('1.005')).toBe(101);
  });

  it('refuses an amount less than nothing', () => {
    expect(readMoney('-5.00', { allowZero: true }).amount).toBeNull();
    expect(readMoney('-5.00', { allowZero: true }).problem).toBe(
      'An amount cannot be less than nothing.'
    );
  });

  it('refuses exponent form, which is a slip rather than a price', () => {
    expect(cents('1e9')).toBeNull();
  });

  it('says nothing about an empty field, because empty is not wrong', () => {
    expect(readMoney('').amount).toBeNull();
    expect(readMoney('').problem).toBeNull();
  });

  it('refuses zero unless the caller says nothing is a real answer', () => {
    expect(readMoney('0.00').amount).toBeNull();
    expect(readMoney('0.00', { allowZero: true }).amount).toBe(0);
  });
});

/**
 * A money field whose OWNER stores cents.
 *
 * The two build editors re-derived the field's text from the stored cents on
 * every render, so every keystroke was reformatted: "18" became "1.00" after
 * the first digit, then "1.008", and settled as "1.01". `readCents` plus a
 * field that holds its own text is the shape that cannot do that, and these
 * cover the part of it that is a rule rather than a render.
 */
describe('readCents', () => {
  it('reads a whole amount without touching the digits after it', () => {
    expect(readCents('18', undefined).cents).toBe(1800);
    expect(readCents('18.50', undefined).cents).toBe(1850);
  });

  it('treats a blank field as nothing set, never as zero', () => {
    expect(readCents('', 1800).cents).toBeUndefined();
    expect(readCents('   ', 1800).cents).toBeUndefined();
    expect(readCents('', 1800).problem).toBeNull();
  });

  it('keeps zero, which is a real answer on a price that adds nothing', () => {
    expect(readCents('0', undefined).cents).toBe(0);
    expect(readCents('0.00', undefined).problem).toBeNull();
  });

  it('leaves the stored amount alone when the text cannot be read', () => {
    const reading = readCents('eighteen', 1800);
    expect(reading.cents).toBe(1800);
    expect(reading.problem).toBe('That does not look like an amount. Try something like 8.50.');
  });

  it('reads the spellings a person actually types', () => {
    expect(readCents('$18.00', undefined).cents).toBe(1800);
    expect(readCents('8,50', undefined).cents).toBe(850);
    expect(readCents('1,250.00', undefined).cents).toBe(125000);
  });
});

describe('optionalMoneyText', () => {
  it('is blank for an amount nobody has set', () => {
    expect(optionalMoneyText(undefined)).toBe('');
  });

  it('settles a stored amount to two decimals, including zero', () => {
    expect(optionalMoneyText(0)).toBe('0.00');
    expect(optionalMoneyText(1800)).toBe('18.00');
    expect(optionalMoneyText(123450)).toBe('1234.50');
  });
});

/**
 * `MoneyInput`, for an amount that can be left blank (sparx persona issue 086).
 *
 * The Pricing tab drew "What it cost you" as `value={cost ?? 0}`, so every one of
 * Gillett Diesel's 777 versions, none of which has a cost on record, read 0.00:
 * a cost nobody entered shown as a cost of nothing. And the way back mapped a
 * typed 0 to "not set", so a part that really did cost nothing could never be
 * recorded as one. "Was" did both of the same things.
 *
 * Removing the `null` branch of `moneyFieldText` reddens the first case;
 * reporting a cleared optional box as 0 reddens the third.
 */
describe('a money field that can be left blank', () => {
  it('shows nothing entered as an empty box, not as 0.00', () => {
    expect(moneyFieldText(null)).toBe('');
  });

  it('shows a real zero as 0.00, and any other amount settled to the cent', () => {
    expect(moneyFieldText(0)).toBe('0.00');
    expect(moneyFieldText(12.5)).toBe('12.50');
  });

  it('reports a cleared box as nothing entered', () => {
    expect(readMoneyField('', { blank: null })).toEqual({ value: null });
    expect(readMoneyField('   ', { blank: null })).toEqual({ value: null });
  });

  it('reports a typed zero as zero, not as nothing entered', () => {
    expect(readMoneyField('0', { blank: null })).toEqual({ value: 0 });
    expect(readMoneyField('0.00', { blank: null })).toEqual({ value: 0 });
    expect(readMoneyField('$0', { blank: null })).toEqual({ value: 0 });
  });

  it('reads an amount the same way whether or not the box can be blank', () => {
    expect(readMoneyField('8,50', { blank: null })).toEqual({ value: 8.5 });
    expect(readMoneyField('8,50', { blank: 0 })).toEqual({ value: 8.5 });
  });

  it('keeps a box that cannot be blank reporting a cleared box as zero', () => {
    expect(readMoneyField('', { blank: 0 })).toEqual({ value: 0 });
  });

  it('reports nothing at all for text it cannot read yet', () => {
    expect(readMoneyField('8x', { blank: null })).toBeNull();
    expect(readMoneyField('8x', { blank: 0 })).toBeNull();
  });
});
