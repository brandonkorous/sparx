// A person or thing with no weekly hours can never be booked, and says so
// (sparx persona issue 118: Gillett's chassis dyno sat unbookable without a word).

import { describe, expect, it } from 'vitest';

import { copyConfirmCopy } from './hours-copy';
import { hoursMissingNotice, resourceState } from './setup-data';

describe('hoursMissingNotice', () => {
  it('warns when it has no weekly hours', () => {
    expect(hoursMissingNotice({ name: 'Chassis dyno', hasWeeklyHours: false })?.title).toBe(
      'No hours yet, so nobody can book Chassis dyno'
    );
  });

  it('says nothing when it has hours, or when nobody looked', () => {
    expect(hoursMissingNotice({ name: 'Bay 1 (light duty)', hasWeeklyHours: true })).toBeNull();
    expect(hoursMissingNotice({ name: 'Bay 1 (light duty)' })).toBeNull();
  });
});

describe('resourceState', () => {
  it('reads No hours for one in use with no weekly hours, and Off with no tone', () => {
    expect(resourceState({ isActive: true, hasWeeklyHours: false })).toEqual({
      label: 'No hours',
      tone: 'warning',
    });
    expect(resourceState({ isActive: true, hasWeeklyHours: true })).toEqual({
      label: 'In use',
      tone: 'success',
    });
    expect(resourceState({ isActive: false })).toEqual({ label: 'Off', tone: undefined });
  });
});

describe('copying hours to something with none', () => {
  it('does not warn about replacing hours that are not there', () => {
    const copy = copyConfirmCopy({
      source: 'Bay 1 (light duty)',
      targets: ['Chassis dyno'],
      closures: 0,
      closedAllWeek: false,
      seasonal: false,
      targetsWithHours: 0,
    });
    expect(copy.description).toContain('They have no weekly hours yet.');
    expect(copy.description).not.toContain('replaced');
    expect(copy.confirmLabel).toBe('Copy hours to Chassis dyno');
  });
});
