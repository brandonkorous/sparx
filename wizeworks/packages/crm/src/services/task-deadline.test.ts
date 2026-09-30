// A TASK IS NOT BORN LATE (issue 892).
//
// Two of Devi's three to-dos wore a red "Overdue" badge, and the database said
// why:
//
//     title                                              created_at      due_at
//     Advance to next stage: Q-000017                    19:49:50.840    19:49:50.836
//     Q-000016 was approved: take it to the next step    08:07:28.297    08:07:28.290
//
// Created and due within SEVEN MILLISECONDS. The deadline was the moment of
// creation, so the task was late before anybody could have read it.
//
// Both automation call sites computed it the same way:
//
//     new Date(Date.now() + cfg.dueInDays * MS_PER_DAY)
//
// and the seeded "billing document approved" automation passes `dueInDays: 0`.
// So does anything that omits the field: `CreateTaskConfig` DEFAULTS it to 0.
//
// ── WHY 24-HOUR ARITHMETIC IS WRONG EVEN WHEN IT IS NOT ZERO ────────────────
//
// A deadline on a to-do list is a DAY. "Today" means by the end of today;
// "tomorrow" means by the end of tomorrow. It does not mean the same minute of
// the clock that some event happened to fire on, so `dueInDays: 1` on a quote
// approved at 2am makes a task that turns red at 2am, hours before the shop
// opens.
//
// And it is the BUSINESS's day. The SLA clock had already learned this in the
// same package: "a promise bootstrapped in UTC quietly counts those hours
// somewhere else - for a shop in Denver every deadline lands six hours early,
// and the first anyone hears of it is a request that went red overnight."
// [[feedback_a_fix_leaves_its_neighbour_behind]]
//
// ── WHY EVERY CASE NAMES TWO ZONES ──────────────────────────────────────────
//
// This machine is in Denver. A test that asserts one Denver answer passes with
// the zone argument deleted, so every assertion below pins ONE instant against
// TWO zones that disagree about it. No zone-blind version can satisfy both
// anywhere on earth. [[feedback_a_test_that_cannot_go_red]]

import { describe, expect, it } from 'vitest';
import { dueAtForDays } from './task-service';

const DENVER = 'America/Denver';
const TOKYO = 'Asia/Tokyo';

describe('dueAtForDays - the end of a day, in the business calendar', () => {
  it('gives the end of TODAY for zero days, not this instant', () => {
    // THE DEFECT. 2:07am in Denver on 30 September; the old rule returned this
    // same instant and the task was overdue on arrival.
    const now = new Date('2026-09-30T08:07:28.290Z');
    const due = dueAtForDays(0, DENVER, now);

    expect(due.getTime()).toBeGreaterThan(now.getTime());
    // 30 September 23:59:59.999 in Denver is 1 October 05:59:59.999 UTC.
    expect(due.toISOString()).toBe('2026-10-01T05:59:59.999Z');
  });

  it('reads the same instant as a different day in a different zone', () => {
    // 08:07 UTC is still the 30th in Denver and already the 30th LATER in
    // Tokyo - 17:07. Both give the end of their own 30 September, and the two
    // are nine hours apart, which is the whole point.
    const now = new Date('2026-09-30T08:07:28.290Z');

    expect(dueAtForDays(0, DENVER, now).toISOString()).toBe('2026-10-01T05:59:59.999Z');
    expect(dueAtForDays(0, TOKYO, now).toISOString()).toBe('2026-09-30T14:59:59.999Z');
  });

  it('puts an evening event on the SAME day, not the next one', () => {
    // 7:49pm Denver on 22 September. The old rule made this due at 7:49pm, and
    // anything reading it after that read "late" while she was still at work.
    const now = new Date('2026-09-23T01:49:50.836Z');

    // In Denver it is still the 22nd, so the end of today is the 22nd's end.
    expect(dueAtForDays(0, DENVER, now).toISOString()).toBe('2026-09-23T05:59:59.999Z');
    // In Tokyo that same instant is already the morning of the 23rd.
    expect(dueAtForDays(0, TOKYO, now).toISOString()).toBe('2026-09-23T14:59:59.999Z');
  });

  it('gives the end of TOMORROW for one day', () => {
    const now = new Date('2026-09-30T08:07:28.290Z');

    expect(dueAtForDays(1, DENVER, now).toISOString()).toBe('2026-10-02T05:59:59.999Z');
    expect(dueAtForDays(1, TOKYO, now).toISOString()).toBe('2026-10-01T14:59:59.999Z');
  });

  it('carries over a month end', () => {
    const now = new Date('2026-09-30T08:07:28.290Z');
    // Denver's 30 September plus two days is 2 October.
    expect(dueAtForDays(2, DENVER, now).toISOString()).toBe('2026-10-03T05:59:59.999Z');
  });

  it('lands on the right wall clock across a spring DST change', () => {
    // 8 March 2026 is when Denver's clocks go forward, so that local day is 23
    // hours long and the offset is not the same at both ends of it. The answer
    // has to be midnight-less-a-millisecond on the LOCAL clock either way.
    const now = new Date('2026-03-08T18:00:00.000Z'); // noon Denver (MDT, UTC-7→-6)
    const due = dueAtForDays(0, DENVER, now);

    expect(due.toISOString()).toBe('2026-03-09T05:59:59.999Z');
    // Noon to the end of that day: twelve hours, less the millisecond.
    expect(due.getTime() - now.getTime()).toBe(12 * 60 * 60 * 1000 - 1);
  });

  it('lands on the right wall clock across an autumn DST change', () => {
    // 1 November 2026, Denver's clocks go back, so that local day is 25 hours.
    const now = new Date('2026-11-01T17:00:00.000Z'); // 10am Denver (MST, UTC-6→-7)
    const due = dueAtForDays(0, DENVER, now);

    expect(due.toISOString()).toBe('2026-11-02T06:59:59.999Z');
    expect(due.getTime() - now.getTime()).toBe(14 * 60 * 60 * 1000 - 1);
  });

  it('never returns a moment that has already passed', () => {
    // The shape of the whole bug in one assertion, swept across a day. Whatever
    // hour it is and wherever the business is, a deadline it has just been
    // given is in the future.
    for (let hour = 0; hour < 24; hour += 1) {
      const now = new Date(Date.UTC(2026, 8, 30, hour, 13, 7, 500));
      for (const zone of [DENVER, TOKYO, 'UTC', 'Pacific/Kiritimati']) {
        expect(dueAtForDays(0, zone, now).getTime()).toBeGreaterThan(now.getTime());
      }
    }
  });

  it('treats a negative or fractional count as today', () => {
    // Nothing should be able to ask for a deadline in the past. The config
    // schema pins this to a whole number from 0, and the rule does not rely on
    // that being the only caller for ever.
    const now = new Date('2026-09-30T08:07:28.290Z');
    const today = dueAtForDays(0, DENVER, now).toISOString();

    expect(dueAtForDays(-5, DENVER, now).toISOString()).toBe(today);
    expect(dueAtForDays(0.9, DENVER, now).toISOString()).toBe(today);
  });
});
