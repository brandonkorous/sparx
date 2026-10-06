// sparx persona issue 025: "Confirm your site details" was ticked for every tenant,
// because every tenant has SOME name from sign-up.
import { describe, expect, it } from 'vitest';
import { nameIsChosen } from '../../src/lib/onboarding-name.js';

describe('nameIsChosen', () => {
  it("does not count sign-up's placeholder", () => {
    expect(nameIsChosen("Doty's workspace", 'eager-harvest-4010')).toBe(false);
  });

  it("does not count the story flow's title-cased web address", () => {
    expect(nameIsChosen('Gillettdiesel', 'gillettdiesel')).toBe(false);
    expect(nameIsChosen('North Loop Fitness', 'north-loop-fitness')).toBe(false);
  });

  it('counts a name the owner typed', () => {
    expect(nameIsChosen('Gillett Diesel Service Inc.', 'gillettdiesel')).toBe(true);
  });

  it('does not count an empty name', () => {
    expect(nameIsChosen('  ', 'gillettdiesel')).toBe(false);
    expect(nameIsChosen(null, null)).toBe(false);
  });
});
