// A service record carries the parts that went into it, and the vehicle it was
// for (sparx persona issue 086). The schema used to know a part only as an
// optional product id, a SKU and a count, so a part linked from an order lost the
// order it came from on the way in: zod drops keys it does not declare, and the
// "link to its order" the record promises had nothing left to link with.

import { describe, expect, it } from 'vitest';

import { CreateBookingInput, LinkedPart, UpdateBookingInput } from './bookings';

const ORDER = '7d0c0a8e-0d8b-4a4e-9a52-2b6f3f0d1a11';
const LINE = '1b7f6c0e-2a8d-4c55-8f1e-5a3d9c2e7b22';
const VARIANT = '9e2b5d14-6c3a-4f7e-b1d0-8a4c2e6f9b33';
const COMPANY = '3c9a7e21-5b4d-4e8f-a6c2-1d0b9f8e7a44';

describe('a linked part keeps the order it came from', () => {
  it('carries the order, the line, the variant and the title through', () => {
    const part = LinkedPart.parse({
      orderId: ORDER,
      orderItemId: LINE,
      orderNumber: 'SO-1042',
      variantId: VARIANT,
      sku: 'FLT-LF3349',
      title: 'Oil filter',
      quantity: 2,
    });
    expect(part).toEqual({
      orderId: ORDER,
      orderItemId: LINE,
      orderNumber: 'SO-1042',
      variantId: VARIANT,
      sku: 'FLT-LF3349',
      title: 'Oil filter',
      quantity: 2,
    });
  });

  it('still reads the older shape: a SKU and a count', () => {
    expect(LinkedPart.parse({ sku: 'FLT-LF3349' })).toEqual({ sku: 'FLT-LF3349', quantity: 1 });
  });

  it('keeps linked parts on a new booking too', () => {
    const input = CreateBookingInput.parse({
      serviceId: ORDER,
      startAt: '2026-10-05T15:00:00.000Z',
      partsLinked: [{ orderId: ORDER, orderNumber: 'SO-1042', sku: 'A', title: 'A', quantity: 1 }],
    });
    expect(input.partsLinked[0]?.orderNumber).toBe('SO-1042');
  });
});

describe('staff can say which trade account a booking is for', () => {
  it('keeps the account on an edit', () => {
    const input = UpdateBookingInput.parse({ id: ORDER, companyId: COMPANY });
    expect(input.companyId).toBe(COMPANY);
  });

  it('lets the account be taken off again', () => {
    const input = UpdateBookingInput.parse({ id: ORDER, companyId: null });
    expect(input.companyId).toBeNull();
  });
});
