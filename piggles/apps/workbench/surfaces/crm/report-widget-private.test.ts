// A shared board's card for a report its maker kept to herself (persona issue
// 264). The API sends that card without the report; the card says why, can be
// moved or taken off, and never runs the report or prints its name.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const source = readFileSync(fileURLToPath(new URL('./report-widget.tsx', import.meta.url)), 'utf8');

/** The body of one top-level function in the widget, up to the next one. */
function body(name: string): string {
  const start = source.indexOf(`function ${name}(`);
  if (start < 0) return '';
  const next = source.indexOf('\nfunction ', start + 1);
  const nextExport = source.indexOf('\nexport function ', start + 1);
  const ends = [next, nextExport].filter((at) => at > start);
  return source.slice(start, ends.length > 0 ? Math.min(...ends) : undefined);
}

describe('a card for a report kept private', () => {
  it('is drawn by its own card whenever the API marks it private', () => {
    expect(body('ReportWidget')).toContain('privateReport');
    expect(body('ReportWidget')).toContain('<PrivateReportCard');
  });

  it('says why, and never runs the report, names it or offers to open it', () => {
    const card = body('PrivateReportCard');
    expect(card).toContain('PRIVATE_CARD_WORDS');
    expect(card).not.toContain('useRunReport');
    expect(card).not.toContain('report.');
    expect(card).not.toContain('onOpen');
    expect(card).not.toContain('onRename');
    // Moving it and taking it off the board stay with whoever arranges the board.
    expect(card).toContain('onRemove');
    expect(card).toContain('onResize');
  });
});
