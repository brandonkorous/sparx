// A return can have a parcel going each way, and both live in one list.
//
// The replacement going out is new. Before it, every row in that list was the
// prepaid label the customer sends the goods back with, so "the label on this
// return" was an unambiguous question and every reader asked it that way. Now it
// is two questions and a reader that asks the old one gets the wrong parcel —
// which is how a customer chasing a replacement ends up on a page about posting
// one.

import { describe, expect, it } from 'vitest';

import {
  EMPTY_SHIPMENT_FORM,
  inboundLabel,
  needsShipmentRecord,
  outboundShipment,
  replacementShipmentBody,
  shipmentCarrierName,
  swapSettledMessage,
} from './return-shipment';
import type { ReturnLabelRecord } from './returns-types';

const label = (over: Partial<ReturnLabelRecord>): ReturnLabelRecord => ({
  id: 'l1',
  direction: 'inbound',
  providerSlug: 'shippo',
  carrier: null,
  labelRef: 'ref',
  trackingNumber: null,
  trackingUrl: null,
  labelMediaId: null,
  costCents: 0,
  shippedAt: null,
  ...over,
});

const INBOUND = label({ id: 'in', direction: 'inbound', trackingNumber: 'RET-1' });
const OUTBOUND = label({
  id: 'out',
  direction: 'outbound',
  providerSlug: 'manual',
  carrier: 'usps',
  labelRef: null,
  trackingNumber: '9400-1',
});

describe('picking a leg', () => {
  it('finds the label the customer sends it back with, whatever order the rows arrive in', () => {
    // The outbound row is newer, so a reader taking "the first label" gets the
    // replacement. That reader would send somebody who wants to POST a parcel to
    // a tracking page for one already sent.
    expect(inboundLabel([OUTBOUND, INBOUND])?.id).toBe('in');
  });

  it('finds the replacement travelling out', () => {
    expect(outboundShipment([INBOUND, OUTBOUND])?.id).toBe('out');
  });

  it('finds nothing rather than the wrong thing when a leg is missing', () => {
    expect(outboundShipment([INBOUND])).toBeUndefined();
    expect(inboundLabel([OUTBOUND])).toBeUndefined();
  });
});

describe('needsShipmentRecord', () => {
  it('asks for the tracking number on a settled swap that has none', () => {
    // The work list. She settled while the customer was waiting and posted it
    // afterwards, so this is the ordinary state rather than an unusual one.
    expect(needsShipmentRecord({ status: 'exchanged', labels: [INBOUND] })).toBe(true);
  });

  it('stops asking once somebody has said', () => {
    expect(needsShipmentRecord({ status: 'exchanged', labels: [INBOUND, OUTBOUND] })).toBe(false);
  });

  it('never asks about a refund, which sends nothing', () => {
    // There is no replacement, so there is no parcel and nothing to track.
    expect(needsShipmentRecord({ status: 'refunded', labels: [] })).toBe(false);
  });

  it('never asks about a return still being decided', () => {
    for (const status of ['requested', 'approved', 'received', 'inspected', 'denied']) {
      expect(needsShipmentRecord({ status, labels: [] })).toBe(false);
    }
  });
});

describe('replacementShipmentBody', () => {
  it('sends NOTHING without a tracking number', () => {
    // A carrier alone gives the customer nothing to follow, and an email whose
    // only job is a number must not go out without one.
    expect(replacementShipmentBody({ ...EMPTY_SHIPMENT_FORM, carrier: 'usps' })).toBeUndefined();
  });

  it('treats whitespace as nothing', () => {
    expect(
      replacementShipmentBody({ ...EMPTY_SHIPMENT_FORM, trackingNumber: '   ' })
    ).toBeUndefined();
  });

  it('drops blank optional fields rather than storing empty answers', () => {
    // A stored '' reads back as "somebody answered this" and would print a
    // carrier heading with nothing under it.
    expect(replacementShipmentBody({ ...EMPTY_SHIPMENT_FORM, trackingNumber: '9400-1' })).toEqual({
      trackingNumber: '9400-1',
    });
  });

  it('keeps the typed name only when they chose Someone else', () => {
    expect(
      replacementShipmentBody({
        carrier: 'other',
        carrierOther: 'Larimer Courier',
        trackingNumber: 'LC-88',
        trackingUrl: '',
      })
    ).toEqual({ carrier: 'other', carrierOther: 'Larimer Courier', trackingNumber: 'LC-88' });
  });

  it('drops a typed name left behind after picking a real carrier', () => {
    // She typed a courier, changed her mind and picked USPS. Sending both would
    // store two answers to one question.
    expect(
      replacementShipmentBody({
        carrier: 'usps',
        carrierOther: 'Larimer Courier',
        trackingNumber: '9400-1',
        trackingUrl: '',
      })
    ).toEqual({ carrier: 'usps', trackingNumber: '9400-1' });
  });
});

describe('shipmentCarrierName', () => {
  it('prefers the name a person gave', () => {
    expect(shipmentCarrierName({ carrier: 'Larimer Courier', providerSlug: 'manual' })).toBe(
      'Larimer Courier'
    );
  });

  it('says nothing rather than "manual", which is not a courier', () => {
    expect(shipmentCarrierName({ carrier: null, providerSlug: 'manual' })).toBe('');
  });

  it('falls back to the provider that bought the label', () => {
    expect(shipmentCarrierName({ carrier: null, providerSlug: 'shippo' })).toBe('shippo');
  });

  it('never shows a shop the code it stored', () => {
    // What Devi actually saw on her own screen after posting a swap by USPS,
    // and what her customer was emailed: the column value, unchanged. The
    // shipping confirmation had this exact defect and it was fixed there.
    expect(shipmentCarrierName({ carrier: 'usps', providerSlug: 'manual' })).toBe('USPS');
    expect(shipmentCarrierName({ carrier: 'fedex', providerSlug: 'manual' })).toBe('FedEx');
  });
});

describe('what a settled swap is said to have done', () => {
  it('does not claim a shelf nobody put anything on', () => {
    // The whole defect in one line. Goods go back on a shelf only once an
    // inspection says they are fit to sell, and this modal opens on a return
    // that has had none — so the old sentence claimed a restock while the pane
    // behind it said nothing had been written down about the goods.
    const said = swapSettledMessage({ unitsRestocked: 0 }, true);
    expect(said).not.toContain('came back on the shelf');
    expect(said).toContain('Nothing has been written down yet about what came back.');
  });

  it('says the tracking number rode along only when it did', () => {
    expect(swapSettledMessage({ unitsRestocked: 1 }, true)).toContain('with its tracking number');
    expect(swapSettledMessage({ unitsRestocked: 1 }, false)).not.toContain('tracking number');
  });

  it('leads with the shelf when something really went back on it', () => {
    expect(swapSettledMessage({ unitsRestocked: 1 }, false)).toBe(
      'One came back on the shelf. The replacement went out, and no money moved.'
    );
  });

  it('counts, rather than saying "one" about three', () => {
    expect(swapSettledMessage({ unitsRestocked: 3 }, false)).toContain('3 came back on the shelf.');
  });
});
