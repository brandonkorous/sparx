// sparx persona issue 330: a suggestion beside an order only when it fits what
// was bought. The shapes are Gillett's own: RAM > 2500 > 6.7L Cummins.

import { describe, expect, it } from 'vitest';

import { fitsWhatWasBought, type FitEntry } from './related-products';

const VEHICLES = 'domain-vehicles';
const RAM = 'ram';
const RAM_2500 = 'ram-2500';
const RAM_3500 = 'ram-3500';
const CUMMINS_67_2500 = 'ram-2500-67';
const CUMMINS_59_2500 = 'ram-2500-59';

const fit = (path: string[], ranges: FitEntry['ranges'] = []): FitEntry => ({
  domainId: VEHICLES,
  nodeId: path.at(-1) ?? null,
  path,
  ranges,
});

/** The DDP injector she bought: a 2500 with the 6.7L Cummins. */
const INJECTOR = [fit([RAM, RAM_2500, CUMMINS_67_2500])];

describe('fitsWhatWasBought', () => {
  it('offers a part for the same engine', () => {
    expect(fitsWhatWasBought([fit([RAM, RAM_2500, CUMMINS_67_2500])], INJECTOR)).toBe(true);
  });

  it('never offers a part for a different engine in the same truck', () => {
    // The exhaust brake for the 5.9L 12-valve the email offered her.
    expect(fitsWhatWasBought([fit([RAM, RAM_2500, CUMMINS_59_2500])], INJECTOR)).toBe(false);
  });

  it('offers a part set to the whole truck line, which holds her engine', () => {
    expect(fitsWhatWasBought([fit([RAM, RAM_2500])], INJECTOR)).toBe(true);
  });

  it('does not offer a part for a narrower fit than what she bought', () => {
    const forEvery2500 = [fit([RAM, RAM_2500])];
    expect(fitsWhatWasBought([fit([RAM, RAM_2500, CUMMINS_67_2500])], forEvery2500)).toBe(false);
  });

  it('never offers a part for another truck', () => {
    expect(fitsWhatWasBought([fit([RAM, RAM_3500])], INJECTOR)).toBe(false);
  });

  it('offers a part set to fit everything in the list', () => {
    expect(fitsWhatWasBought([{ ...fit([]), nodeId: null }], INJECTOR)).toBe(true);
  });

  it('does not cross into another list', () => {
    expect(
      fitsWhatWasBought([{ ...fit([RAM, RAM_2500]), domainId: 'domain-trailers' }], INJECTOR)
    ).toBe(false);
  });

  it('needs the year windows to meet when both parts set one', () => {
    const bought = [fit([RAM, RAM_2500], [{ dimensionKey: 'year', min: 2007, max: 2018 }])];
    const older = [fit([RAM, RAM_2500], [{ dimensionKey: 'year', min: 1994, max: 1998 }])];
    const overlapping = [fit([RAM, RAM_2500], [{ dimensionKey: 'year', min: 2013, max: 2024 }])];
    const anyYear = [fit([RAM, RAM_2500])];
    expect(fitsWhatWasBought(older, bought)).toBe(false);
    expect(fitsWhatWasBought(overlapping, bought)).toBe(true);
    expect(fitsWhatWasBought(anyYear, bought)).toBe(true);
  });

  it('offers nothing for a part with no fit set', () => {
    expect(fitsWhatWasBought([], INJECTOR)).toBe(false);
  });
});
