import { describe, expect, it } from 'vitest';
import {
  awayMessageNote,
  chatIsAwayAllWeek,
  hoursNote,
  openDayCount,
  type DayWindow,
} from './availability-words';

// A BOX EXPLAINING WHEN SOMETHING IS SHOWN, WHEN IT CAN NEVER BE SHOWN.
//
// Chat settings asked for an away message and said "Shown when you are outside
// your available hours" — over a switch, further down the same screen, whose own
// sentence already read "Chat is always available. There is no away state."
// 13 of the 14 shops with a chat box are in exactly that state.

const day = (): DayWindow => ({ open: '09:00', close: '17:00' });

describe('counting the days a shop answers', () => {
  it('is zero for a switch that was turned on and left alone', () => {
    expect(openDayCount({})).toBe(0);
    expect(openDayCount(undefined)).toBe(0);
  });

  it('does not count a day that was switched back off', () => {
    // A day that was open and is not is stored as null, not removed.
    expect(openDayCount({ '1': day(), '2': null, '3': day() })).toBe(2);
  });
});

describe('the sentence under the away message', () => {
  it('says nobody sees it when no hours are set', () => {
    const note = awayMessageNote(false, 0);
    expect(note).toContain('nobody ever sees this');
    // And it names the control that would change that, which is further down the
    // same screen than the box she is looking at.
    expect(note).toContain('Set specific hours');
  });

  it('says everybody sees it when the hours are on and no day is', () => {
    const note = awayMessageNote(true, 0);
    expect(note).toContain('every hour of the week');
  });

  it('does the job it describes once a day is open', () => {
    expect(awayMessageNote(true, 3)).toBe(
      'Shown when you are outside your available hours, so people know what to expect.'
    );
  });

  it('never says the same thing in two different states', () => {
    // The whole defect in one assertion: one fixed sentence for three states.
    const notes = [awayMessageNote(false, 0), awayMessageNote(true, 0), awayMessageNote(true, 2)];
    expect(new Set(notes).size).toBe(3);
  });
});

describe('the sentence under the hours switch', () => {
  it('keeps the honest no-hours reading', () => {
    expect(hoursNote(false, 0)).toBe('Chat is always available. There is no away state.');
  });

  it('names the state where the shop thinks it is open and is not', () => {
    // isWithinOperatingHours answers `if (!window) return false` for a day with
    // no window, so hours on with no day open closes the chat all week.
    const note = hoursNote(true, 0);
    expect(note).toContain('away all week');
    expect(note).toContain('Switch on the days you answer');
  });

  it('describes the ordinary case once a day is open', () => {
    expect(hoursNote(true, 1)).toContain('Outside these hours');
  });
});

describe('when to warn rather than describe', () => {
  it('warns only about hours that are on and empty', () => {
    expect(chatIsAwayAllWeek(true, 0)).toBe(true);
    // No hours at all is a fine way to run a chat box, not a mistake.
    expect(chatIsAwayAllWeek(false, 0)).toBe(false);
    expect(chatIsAwayAllWeek(true, 1)).toBe(false);
  });
});
