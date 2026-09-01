// Who gets emailed when somebody fills in a form.
//
// Pinned because the field takes free text and the server's 400 names no line, so
// this is what stands between an owner and a rejected save she cannot explain
// (issue 355).

import { describe, expect, it } from 'vitest';
import { firstInvalidRecipient, parseRecipients } from './form-settings-data';

describe('parseRecipients', () => {
  it('splits on commas and newlines alike', () => {
    // She will type it whichever way she thinks of it, and both are one list.
    expect(parseRecipients('devi@juniperrow.test, hello@juniperrow.test')).toEqual([
      'devi@juniperrow.test',
      'hello@juniperrow.test',
    ]);
    expect(parseRecipients('devi@juniperrow.test\nhello@juniperrow.test')).toEqual([
      'devi@juniperrow.test',
      'hello@juniperrow.test',
    ]);
  });

  it('drops the empties a trailing comma or a stray blank line leaves', () => {
    expect(parseRecipients('devi@juniperrow.test,\n\n , ')).toEqual(['devi@juniperrow.test']);
  });

  it('is empty for empty text, rather than one empty address', () => {
    expect(parseRecipients('')).toEqual([]);
    expect(parseRecipients('   \n  ')).toEqual([]);
  });
});

describe('firstInvalidRecipient', () => {
  it('is null when every address is one', () => {
    expect(firstInvalidRecipient(['devi@juniperrow.test', 'a.b+tag@sub.example.co.uk'])).toBeNull();
    expect(firstInvalidRecipient([])).toBeNull();
  });

  it('names the FIRST bad one, so she knows which line to fix', () => {
    expect(firstInvalidRecipient(['devi@juniperrow.test', 'hello at juniperrow', 'also-bad'])).toBe(
      'hello at juniperrow'
    );
  });

  it('rejects the shapes a person actually mistypes', () => {
    expect(firstInvalidRecipient(['devi@'])).toBe('devi@');
    expect(firstInvalidRecipient(['@juniperrow.test'])).toBe('@juniperrow.test');
    expect(firstInvalidRecipient(['devi@juniperrow'])).toBe('devi@juniperrow');
  });
});
