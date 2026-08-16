import { describe, expect, it } from 'vitest';
import { emailLayerRows, emailRowLabel } from './layers';
import { emailBody, emailText } from '../../testing/fixtures';

describe('emailLayerRows', () => {
  it('lists every node, parents before children, with the email itself first', () => {
    const rows = emailLayerRows(emailBody());
    expect(rows.map((row) => row.id)).toEqual([
      'body',
      'intro',
      'greeting',
      'row',
      'cols',
      'left',
      'left-copy',
      'right',
      'cta',
    ]);
    expect(rows[0]).toMatchObject({ label: 'Email', depth: 0 });
    expect(rows.find((row) => row.id === 'left-copy')?.depth).toBe(4);
  });

  it('marks which rows can hold others', () => {
    const rows = emailLayerRows(emailBody());
    expect(rows.find((row) => row.id === 'cols')?.container).toBe(true);
    expect(rows.find((row) => row.id === 'cta')?.container).toBe(false);
  });
});

describe('emailRowLabel', () => {
  it('prefers the name the author gave the block', () => {
    expect(emailRowLabel({ ...emailText('t', 'Hello'), name: 'Order summary' })).toBe(
      'Order summary'
    );
  });

  it('falls back to the block’s own words, so two bands are tellable apart', () => {
    expect(emailRowLabel(emailText('t', 'Thanks for your order'))).toBe('Thanks for your order');
  });

  it('strips markup out of the fallback', () => {
    expect(emailRowLabel(emailText('t', 'Thanks, <b>Nadia</b>'))).toBe('Thanks, Nadia');
  });

  it('truncates a long fallback rather than pushing the row wide', () => {
    const label = emailRowLabel(emailText('t', 'a'.repeat(60)));
    expect(label).toHaveLength(33);
    expect(label.endsWith('…')).toBe(true);
  });

  it('falls back to the kind when there is nothing to show', () => {
    expect(emailRowLabel(emailText('t', '   '))).toBe('Text');
  });
});
