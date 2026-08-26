import { describe, expect, it } from 'vitest';
import {
  estimateSegments,
  isQuietHour,
  localHourIn,
  nextSendableAt,
  normalizePhone,
} from './policy';

describe('normalizePhone — the comparison key', () => {
  it('strips the formatting people type', () => {
    expect(normalizePhone('+1 (555) 010-0199')).toBe('+15550100199');
    expect(normalizePhone('555.010.0199')).toBe('+5550100199');
  });

  it('is stable, so a suppression written one way is found the other', () => {
    // The whole failure this prevents: a STOP stored as typed and looked up as
    // formatted is a suppression that silently does not apply.
    expect(normalizePhone('+1 555 010 0199')).toBe(normalizePhone('+1(555)0100199'));
  });
});

describe('isQuietHour — the wrapping window', () => {
  const OVERNIGHT = { startHour: 21, endHour: 9 };

  it('covers the evening, midnight and the early morning', () => {
    for (const hour of [21, 22, 23, 0, 3, 8]) {
      expect(isQuietHour(hour, OVERNIGHT), `hour ${String(hour)}`).toBe(true);
    }
  });

  it('leaves the working day alone', () => {
    for (const hour of [9, 12, 17, 20]) {
      expect(isQuietHour(hour, OVERNIGHT), `hour ${String(hour)}`).toBe(false);
    }
  });

  it('treats the start as inclusive and the end as exclusive', () => {
    expect(isQuietHour(21, OVERNIGHT)).toBe(true);
    expect(isQuietHour(9, OVERNIGHT)).toBe(false);
  });

  it('handles a non-wrapping window too', () => {
    expect(isQuietHour(12, { startHour: 9, endHour: 17 })).toBe(true);
    expect(isQuietHour(20, { startHour: 9, endHour: 17 })).toBe(false);
  });

  it('treats equal bounds as quiet hours being OFF', () => {
    // Reading a zero-length window as always-on would silently stop every
    // message the tenant sends, with nothing on screen to explain it.
    for (const hour of [0, 9, 21, 23]) {
      expect(isQuietHour(hour, { startHour: 9, endHour: 9 })).toBe(false);
    }
  });
});

describe('localHourIn — whose clock', () => {
  // 2026-08-26T02:00:00Z — 3am in London (BST), 10am in Singapore, 10pm on the
  // 25th in New York.
  const NOW = new Date('2026-08-26T02:00:00Z');

  it('reads the hour where the RECIPIENT is', () => {
    expect(localHourIn('Europe/London', NOW)).toBe(3);
    expect(localHourIn('Asia/Singapore', NOW)).toBe(10);
    expect(localHourIn('America/New_York', NOW)).toBe(22);
  });

  it('is the difference between quiet and not', () => {
    const quiet = { startHour: 21, endHour: 9 };
    // The same instant is the middle of the night in London and mid-morning in
    // Singapore. Enforcing against the sender's clock gets one of them wrong.
    expect(isQuietHour(localHourIn('Europe/London', NOW)!, quiet)).toBe(true);
    expect(isQuietHour(localHourIn('Asia/Singapore', NOW)!, quiet)).toBe(false);
  });

  it('returns null for an unusable timezone rather than guessing', () => {
    expect(localHourIn('Mars/Olympus_Mons', NOW)).toBeNull();
    expect(localHourIn('', NOW)).toBeNull();
  });

  it('reports midnight as 0', () => {
    expect(localHourIn('UTC', new Date('2026-08-26T00:30:00Z'))).toBe(0);
  });
});

describe('nextSendableAt — when a held message goes', () => {
  const quiet = { startHour: 21, endHour: 9 };

  it('lands at the end of quiet hours, on the hour', () => {
    // 02:00Z is 22:00 in New York — held until 9am local, which is 13:00Z.
    const at = nextSendableAt('America/New_York', quiet, new Date('2026-08-26T02:00:00Z'));
    expect(localHourIn('America/New_York', at)).toBe(9);
    expect(at.getUTCMinutes()).toBe(0);
  });

  it('is soon when quiet hours are nearly over', () => {
    const now = new Date('2026-08-26T07:30:00Z'); // 08:30 in London
    const at = nextSendableAt('Europe/London', quiet, now);
    expect(at.getTime() - now.getTime()).toBeLessThan(2 * 60 * 60 * 1000);
  });

  it('still returns a time for an unusable timezone', () => {
    // Never returns null: a held message with no time attached reads as lost.
    expect(nextSendableAt('Nowhere/Nothing', quiet, new Date()).getTime()).toBeGreaterThan(0);
  });
});

describe('estimateSegments — what it will be billed as', () => {
  it('counts a short plain message as one', () => {
    expect(estimateSegments('Your appointment is confirmed for Tuesday at 2pm.')).toBe(1);
  });

  it('counts nothing as nothing', () => {
    expect(estimateSegments('')).toBe(0);
  });

  it('splits a long plain message at 160', () => {
    expect(estimateSegments('a'.repeat(160))).toBe(1);
    expect(estimateSegments('a'.repeat(161))).toBe(2);
    expect(estimateSegments('a'.repeat(306))).toBe(2);
    expect(estimateSegments('a'.repeat(307))).toBe(3);
  });

  it('more than halves the limit for one curly apostrophe', () => {
    // The thing nobody expects: a single smart quote pasted from a word
    // processor turns a one-text message into two, and the tenant finds out on
    // the invoice.
    expect(estimateSegments('a'.repeat(80))).toBe(1);
    expect(estimateSegments(`${'a'.repeat(79)}’`)).toBe(2);
  });

  it('treats an emoji the same way, and counts it as TWO units', () => {
    // An astral emoji is a surrogate pair, which the carrier bills as two of
    // the 70. 69 + 2 = 71, so this is two texts even though it looks like 70
    // characters — the exact case counting code points would get wrong.
    expect(estimateSegments(`${'a'.repeat(69)}🎉`)).toBe(2);
    expect(estimateSegments(`${'a'.repeat(68)}🎉`)).toBe(1);
  });

  it('charges double for an accent GSM does NOT carry', () => {
    // `ò` is in the alphabet and `ô` is not, which is the kind of difference
    // nobody can eyeball — two versions of the test above got it wrong before
    // the function did.
    expect(estimateSegments(`${'a'.repeat(80)}ò`)).toBe(1);
    expect(estimateSegments(`${'a'.repeat(80)}ô`)).toBe(2);
  });

  it('keeps the currency and accented characters GSM sends natively', () => {
    // Every one of these IS in GSM 03.38, so they cost nothing extra.
    expect(estimateSegments(`£20 off, merci à Señor Müller ¿Ok? ${'a'.repeat(100)}`)).toBe(1);
  });
});
