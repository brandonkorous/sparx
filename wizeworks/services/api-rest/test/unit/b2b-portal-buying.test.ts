// Who may order again, keep saved carts and build a quote request on a trade
// account, and whose orders they reach (sparx persona issue 086).
//
// Every one of these routes first finds the caller's ACTIVE contact row on the
// account in the path (403 without one), then hands that account id to services
// that scope every read and write by it (their own tests prove a saved cart, a
// request or an order from another account finds nothing). What is left to pin
// here is the role rule and the order scope the routes compute.

import { describe, expect, it } from 'vitest';

import {
  accountOrderCustomers,
  canOrderOnAccount,
  portalOrderWhere,
} from '../../src/routes/v1/public/b2b-portal-buying.js';

const RENEE = 'fd7795a2-99f3-4583-b7be-efcb2d886a1b';
const DALE = '2c3d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e6f';
const ORDER = 'f3d0a7c2-1b5e-4f8a-9c6d-2e7b8a9c0d12';

describe('who can order on an account', () => {
  it('is the primary contact and a buyer', () => {
    expect(canOrderOnAccount('primary_contact')).toBe(true);
    expect(canOrderOnAccount('buyer')).toBe(true);
  });

  it('is never a viewer or an approver', () => {
    expect(canOrderOnAccount('viewer')).toBe(false);
    expect(canOrderOnAccount('approver')).toBe(false);
    expect(canOrderOnAccount('')).toBe(false);
  });
});

describe('whose orders a contact reaches', () => {
  it('is the whole account for a role that can order', () => {
    expect(accountOrderCustomers('buyer', RENEE, [RENEE, DALE])).toEqual([RENEE, DALE]);
  });

  it('is only their own for a viewer', () => {
    expect(accountOrderCustomers('viewer', RENEE, [RENEE, DALE])).toEqual([RENEE]);
  });

  it('asks for the order AND who placed it, never the order alone', () => {
    expect(portalOrderWhere(ORDER, [RENEE])).toEqual({ id: ORDER, customerId: { in: [RENEE] } });
    // No contacts means no order, not every order.
    expect(portalOrderWhere(ORDER, [])).toEqual({ id: ORDER, customerId: { in: [] } });
  });
});
