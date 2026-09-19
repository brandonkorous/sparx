import { describe, expect, it } from 'vitest';
import {
  alreadyComingLine,
  draftedOutcome,
  reorderHint,
  unsuppliedNote,
} from './reorder-supplier-words';

describe('the notice about lines with no supplier', () => {
  it('says nothing when every line can be ordered', () => {
    expect(unsuppliedNote(0, 12)).toBeNull();
  });

  it('says nothing before the counts have arrived', () => {
    // The count rides on the list response, so it is undefined for the first
    // render. A notice that flashes "none of these can be ordered" and then
    // disappears is worse than one that waits.
    expect(unsuppliedNote(undefined, 12)).toBeNull();
    expect(unsuppliedNote(3, undefined)).toBeNull();
  });

  it('says so plainly when the whole list is un-orderable', () => {
    // Measured as P03 on Juniper Row: 1 line on the worklist, no supplier, and
    // the only thing the screen said was a tick box that would not tick.
    const note = unsuppliedNote(65, 65);
    expect(note?.title).toBe('None of these can be ordered yet');
    expect(note?.body).toContain('no supplier is linked to any of these items');
    expect(note?.body).toContain('What you buy from this supplier');
    // It must not promise that the rest are fine, because there is no rest.
    expect(note?.body).not.toContain('The other');
  });

  it('speaks in the singular for a one-line list', () => {
    const note = unsuppliedNote(1, 1);
    expect(note?.title).toBe('This one cannot be ordered yet');
    expect(note?.body).toContain('no supplier is linked to this item');
    expect(note?.body).not.toContain('these items');
  });

  it('counts both halves when only some lines are stuck', () => {
    const note = unsuppliedNote(3, 12);
    expect(note?.title).toBe('3 of these need a supplier first');
    expect(note?.body).toContain('3 of them');
    expect(note?.body).toContain('their tick boxes stay off');
    expect(note?.body).toContain('The other 9 lines can be chosen and drafted as normal');
  });

  it('keeps one stuck line singular on both sides of the sentence', () => {
    const note = unsuppliedNote(1, 2);
    expect(note?.title).toBe('1 of these needs a supplier first');
    expect(note?.body).toContain('one of them');
    expect(note?.body).toContain('its tick box stays off');
    expect(note?.body).toContain('The other 1 line can be chosen');
  });
});

describe('the footer hint', () => {
  it('invites choosing only when something can be chosen', () => {
    expect(reorderHint(4)).toBe(
      'Choose lines to draft orders · click a row to see how its figures were worked out · shift-click alongside'
    );
  });

  it('drops the invitation when not one line on the page can be chosen', () => {
    // The whole defect in one assertion: this sentence was shown whenever the
    // list had rows, including on a page where every tick box was dead.
    const hint = reorderHint(0);
    expect(hint).not.toContain('Choose lines');
    expect(hint).toBe('Click a row to see how its figures were worked out · shift-click alongside');
  });
});

describe('warning that stock is already coming', () => {
  it('says nothing when none of the chosen lines have an open order', () => {
    expect(alreadyComingLine([{ onOrder: 0 }, { onOrder: 0 }])).toBeNull();
  });

  it('names the units when one line already has stock coming', () => {
    // Measured as P03: PO-000003 for 12, the row then said "12 already on the
    // way", and the screen let her draft PO-000004 for 12 more in silence.
    const line = alreadyComingLine([{ onOrder: 12 }]);
    expect(line).toContain('One of these already has stock on the way');
    expect(line).toContain('12 units');
    expect(line).toContain('asks for that much again');
  });

  it('adds the units up across several lines', () => {
    const line = alreadyComingLine([{ onOrder: 12 }, { onOrder: 0 }, { onOrder: 3 }]);
    expect(line).toContain('2 of these already have stock on the way');
    expect(line).toContain('15 units');
  });

  it('says one unit in the singular', () => {
    expect(alreadyComingLine([{ onOrder: 1 }])).toContain('1 unit on an order');
  });
});

describe('what the drafting actually did', () => {
  it('says created when every order is new', () => {
    const out = draftedOutcome([{ number: 'PO-000003', appended: false }]);
    expect(out.title).toBe('1 draft order created');
    expect(out.description).toContain('PO-000003');
  });

  it('does not claim to have created an order that already existed', () => {
    // The console used to start a new PO every time, so "created" was always
    // true. It now joins the draft already open for that supplier and location.
    const out = draftedOutcome([{ number: 'PO-000003', appended: true }]);
    expect(out.title).not.toContain('created');
    expect(out.title).toBe('Added to a draft order you already had');
    expect(out.description).toContain('Nothing new was created');
    expect(out.description).toContain('that supplier already had an order open');
  });

  it('counts both when some were new and some were joined', () => {
    const out = draftedOutcome([
      { number: 'PO-000003', appended: false },
      { number: 'PO-000005', appended: true },
    ]);
    expect(out.title).toBe('2 draft orders updated');
    expect(out.description).toContain('1 new, and 1 added to an order that was already open');
  });
});
