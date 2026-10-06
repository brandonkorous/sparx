// "Fits your fleet" on the shop's own pages (sparx persona issue 086).
//
//   1. A product with no fitment data says NOTHING. The website prints a present
//      answer with no vehicles as "does not fit any vehicle in your fleet", so a
//      bag of shop rags must come back null, not { fits: false }.
//   2. "Parts that fit Unit 12" only ever reads the signed-in buyer's OWN fleet. A
//      vehicle id from another account is not found there, so nothing is applied
//      and nothing about the other account's fleet is read.
//   3. Fitted parts first is a reordering of the same listing: the page window
//      over "fitted, then the rest" never skips or repeats a product.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const b2b = vi.hoisted(() => ({
  fleetFitForProducts: vi.fn(),
  fleetFittedProductIds: vi.fn(),
  getAccountFleet: vi.fn(),
}));
vi.mock('@wizeworks/b2b', () => b2b);

import { fittedFirstPage, fittedFirstWindow, vehicleRestriction, withFleetFit } from './fleet-fit';

const MINE = '8aa59a36-acc9-455f-b0ba-41c0b66292b9';
const UNIT_12 = '11111111-1111-4111-8111-111111111111';
const THEIRS = '22222222-2222-4222-8222-222222222222';

const unit12 = {
  id: UNIT_12,
  label: 'Unit 12',
  year: 2019,
  make: null,
  model: null,
  nodePath: ['Ram', '3500', '6.7L Cummins'],
};

beforeEach(() => {
  b2b.fleetFitForProducts.mockReset();
  b2b.fleetFittedProductIds.mockReset();
  b2b.getAccountFleet.mockReset();
});

describe('withFleetFit', () => {
  it('names the vehicles a part fits, warns on a part that fits none, and says nothing about a part with no fitment data', async () => {
    b2b.fleetFitForProducts.mockResolvedValue({
      vehicles: [unit12],
      fits: new Map([
        ['filter', [UNIT_12]],
        ['injector', []],
      ]),
    });
    const out = await withFleetFit(
      't1',
      [{ id: 'filter' }, { id: 'injector' }, { id: 'shop-rags' }],
      MINE
    );
    expect(out[0]!.fleetFit).toEqual({
      fits: true,
      vehicles: [{ id: UNIT_12, label: 'Unit 12, 2019 Ram 3500 6.7L Cummins' }],
    });
    expect(out[1]!.fleetFit).toEqual({ fits: false, vehicles: [] });
    expect(out[2]!.fleetFit).toBeNull();
  });

  it('says nothing for a shopper with no trade account, without reading any fleet', async () => {
    const out = await withFleetFit('t1', [{ id: 'filter' }], undefined);
    expect(out[0]!.fleetFit).toBeNull();
    expect(b2b.fleetFitForProducts).not.toHaveBeenCalled();
  });

  it('never fails the listing it decorates', async () => {
    b2b.fleetFitForProducts.mockRejectedValue(new Error('db down'));
    const out = await withFleetFit('t1', [{ id: 'filter' }], MINE);
    expect(out).toEqual([{ id: 'filter', fleetFit: null }]);
  });
});

describe('vehicleRestriction', () => {
  it('applies one of the buyer’s own vehicles', async () => {
    b2b.getAccountFleet.mockResolvedValue([unit12]);
    b2b.fleetFittedProductIds.mockResolvedValue(['filter']);
    await expect(vehicleRestriction('t1', MINE, UNIT_12)).resolves.toEqual({
      applied: true,
      vehicle: { id: UNIT_12, label: 'Unit 12, 2019 Ram 3500 6.7L Cummins' },
      productIds: ['filter'],
    });
    expect(b2b.fleetFittedProductIds).toHaveBeenCalledWith({ tenantId: 't1' }, MINE, {
      vehicleId: UNIT_12,
    });
  });

  it('does not reach another account’s vehicle', async () => {
    b2b.getAccountFleet.mockResolvedValue([unit12]);
    await expect(vehicleRestriction('t1', MINE, THEIRS)).resolves.toEqual({ applied: false });
    expect(b2b.getAccountFleet).toHaveBeenCalledWith({ tenantId: 't1' }, MINE);
    expect(b2b.fleetFittedProductIds).not.toHaveBeenCalled();
  });

  it('applies nothing for a shopper who is not signed in to a trade account', async () => {
    await expect(vehicleRestriction('t1', undefined, UNIT_12)).resolves.toEqual({
      applied: false,
    });
    expect(b2b.getAccountFleet).not.toHaveBeenCalled();
  });
});

describe('fitted parts first', () => {
  it('splits a page across the fitted group and the rest', () => {
    expect(fittedFirstWindow(0, 24, 30)).toEqual({
      fitted: { skip: 0, take: 24 },
      rest: { skip: 0, take: 0 },
    });
    expect(fittedFirstWindow(24, 24, 30)).toEqual({
      fitted: { skip: 24, take: 6 },
      rest: { skip: 0, take: 18 },
    });
    expect(fittedFirstWindow(48, 24, 30)).toEqual({
      fitted: { skip: 30, take: 0 },
      rest: { skip: 18, take: 24 },
    });
  });

  it('walks the whole listing once, fitted first, with nothing skipped or repeated', async () => {
    const all = Array.from({ length: 10 }, (_, i) => `p${i}`);
    const fittedIds = ['p7', 'p2', 'p9'];
    const pick = (ids: { in?: string[]; notIn?: string[] }) =>
      all.filter((p) => (ids.in ? ids.in.includes(p) : !ids.notIn!.includes(p)));
    const pages: string[] = [];
    for (let skip = 0; skip < all.length; skip += 4) {
      pages.push(
        ...(await fittedFirstPage({
          fittedIds,
          skip,
          take: 4,
          count: (ids) => Promise.resolve(pick(ids).length),
          find: (ids, s, t) => Promise.resolve(pick(ids).slice(s, s + t)),
        }))
      );
    }
    expect(pages).toEqual(['p2', 'p7', 'p9', 'p0', 'p1', 'p3', 'p4', 'p5', 'p6', 'p8']);
  });
});
