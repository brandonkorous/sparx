// The words a fleet vehicle is called by (sparx persona issue 086).
//
// Every surface prints a vehicle through these, so the buyer reads the same
// "Unit 12, 2019 Ram 3500 6.7L Cummins" on the product page, their fleet page and
// the shop's console.

import { describe, expect, it } from 'vitest';

import { chooseLevelLabel, fitsSentence, vehicleDescription, vehicleLabel } from './fleet';

const unit12 = {
  label: 'Unit 12',
  year: 2019,
  make: null,
  model: null,
  nodePath: ['Ram', '3500', '6.7L Cummins'],
};

describe('vehicleLabel', () => {
  it('names the vehicle, then says what it is', () => {
    expect(vehicleLabel(unit12)).toBe('Unit 12, 2019 Ram 3500 6.7L Cummins');
  });

  it('reads the make and model typed by hand when nothing was picked from the list', () => {
    expect(
      vehicleLabel({
        label: 'Plow truck',
        year: 2008,
        make: 'Mack',
        model: 'Granite',
        nodePath: [],
      })
    ).toBe('Plow truck, 2008 Mack Granite');
  });

  it('prefers the picked list entry over hand-typed words', () => {
    expect(vehicleLabel({ ...unit12, make: 'Dodge', model: 'Ram' })).toBe(
      'Unit 12, 2019 Ram 3500 6.7L Cummins'
    );
  });

  it('says the name alone when nothing else is known', () => {
    expect(
      vehicleLabel({ label: 'Unit 7', year: null, make: null, model: null, nodePath: [] })
    ).toBe('Unit 7');
  });

  it('never repeats itself when the name is the description', () => {
    expect(vehicleLabel({ ...unit12, label: '2019 Ram 3500 6.7L Cummins' })).toBe(
      '2019 Ram 3500 6.7L Cummins'
    );
  });

  it('falls back to the description, then to a plain word, when there is no name', () => {
    expect(vehicleLabel({ ...unit12, label: '  ' })).toBe('2019 Ram 3500 6.7L Cummins');
    expect(vehicleLabel({ label: '', year: null, make: null, model: null, nodePath: [] })).toBe(
      'Vehicle'
    );
  });
});

describe('vehicleDescription', () => {
  it('leaves out what is not known', () => {
    expect(vehicleDescription({ year: null, make: 'Ford', model: null, nodePath: [] })).toBe(
      'Ford'
    );
  });
});

describe('fitsSentence', () => {
  it('reads as a sentence for one, two and several vehicles', () => {
    expect(fitsSentence([{ label: 'Unit 12, 2019 Ram 3500' }])).toBe('Fits Unit 12, 2019 Ram 3500');
    expect(fitsSentence([{ label: 'Unit 12' }, { label: 'Unit 14' }])).toBe(
      'Fits Unit 12 and Unit 14'
    );
    expect(
      fitsSentence([{ label: 'Unit 12, Ram' }, { label: 'Unit 14, Ford' }, { label: 'Unit 3' }])
    ).toBe('Fits Unit 12, Ram; Unit 14, Ford; and Unit 3');
  });

  it('says nothing when it fits nothing', () => {
    expect(fitsSentence([])).toBe('');
  });
});

describe('chooseLevelLabel', () => {
  it('says "an" before a vowel sound', () => {
    expect(chooseLevelLabel('Engine')).toBe('Choose an engine');
  });

  it('says "a" before anything else', () => {
    expect(chooseLevelLabel('Make')).toBe('Choose a make');
    expect(chooseLevelLabel('Model')).toBe('Choose a model');
    expect(chooseLevelLabel('Year')).toBe('Choose a year');
  });
});
