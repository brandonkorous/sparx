// EVERY WAY A CUSTOMER CAN ARRIVE HAS TO HAVE A NAME, AND "WE DO NOT KNOW" IS
// NOT ONE OF THE WAYS.
//
// `leadsBySource` backs the panel headed "Where new customers come from". It
// kept its own copy of the order-channel word list, and that copy went stale:
// `marketplace` was added to the channel set and never added here, so a
// customer whose first order came through a marketplace read the raw key
// `marketplace` — lowercase, unspaced — on screen.
//
// The second half is worse. A customer with no order at all was reported as
// `direct`, which reads like a channel and means "we never found out". 686 of
// 745 customers on the dev database landed there.
//
// This walks the channel set itself rather than a list typed in here, so the
// NEXT channel cannot repeat the first bug: adding one to `OrderChannel`
// without a label reddens this file.

import { describe, expect, it } from 'vitest';
import { OrderChannel, ORDER_CHANNEL_LABELS } from '@wizeworks/crm-schemas';

import { LEAD_SOURCE_NONE, leadSourceLabel } from './reporting-service';

describe('the name on a lead source', () => {
  it('covers every order channel, including the one the old copy missed', () => {
    // The denominator. A scan that resolved two channels would pass everything
    // below without saying so.
    expect(OrderChannel.options.length).toBeGreaterThanOrEqual(6);
    expect(OrderChannel.options).toContain('marketplace');

    for (const channel of OrderChannel.options) {
      const label = leadSourceLabel(channel);
      expect(label, `the label for "${channel}"`).not.toBe(channel);
      expect(label.trim().length, `the label for "${channel}"`).toBeGreaterThan(0);
    }
  });

  it('names a marketplace customer rather than printing the key', () => {
    expect(leadSourceLabel('marketplace')).toBe('Marketplace');
  });

  it('names the marketplace a customer actually came through', () => {
    // The query keys a marketplace order by its slug, so each one is its own
    // line: a maker wants to see Faire and Etsy apart, not "Marketplace 9".
    expect(leadSourceLabel('faire')).toBe('Faire');
    expect(leadSourceLabel('etsy')).toBe('Etsy');
  });

  it('says a customer has not ordered, rather than naming a way they arrived', () => {
    const label = leadSourceLabel(LEAD_SOURCE_NONE);
    expect(label).toBe('No order yet');
    // The thing that went wrong: the absence wore a channel's name. Whatever
    // this key is called, it must not be one of the ways a customer can arrive.
    expect(Object.keys(ORDER_CHANNEL_LABELS)).not.toContain(LEAD_SOURCE_NONE);
    expect(OrderChannel.options as readonly string[]).not.toContain(LEAD_SOURCE_NONE);
  });

  it('keeps an unknown key visible instead of inventing a source for it', () => {
    // A channel nobody has labelled should read oddly and get fixed, never
    // quietly become "Direct".
    expect(leadSourceLabel('something_new')).toBe('something_new');
  });
});
