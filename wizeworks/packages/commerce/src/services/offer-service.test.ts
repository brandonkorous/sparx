import { describe, expect, it } from 'vitest';
import { pickOffer, type OfferCandidate } from './offer-service';

const offer = (over: Partial<OfferCandidate> & { id: string }): OfferCandidate => ({
  variantId: `v-${over.id}`,
  headline: 'Add a gift box',
  blurb: null,
  ctaLabel: 'Add this',
  triggerVariantIds: [],
  priority: 100,
  ...over,
});

describe('pickOffer — one offer, at the right moment', () => {
  it('offers an untriggered add-on to anybody', () => {
    const picked = pickOffer([offer({ id: 'a' })], ['v-mug']);
    expect(picked?.id).toBe('a');
  });

  it('offers a triggered one only when its trigger is in the basket', () => {
    const gift = offer({ id: 'gift', triggerVariantIds: ['v-mug', 'v-plate'] });
    expect(pickOffer([gift], ['v-mug'])?.id).toBe('gift');
    expect(pickOffer([gift], ['v-spoon'])).toBeNull();
  });

  it('never offers somebody a thing they are already buying', () => {
    // It reads as a bug to the customer, and as a double charge if they take it.
    const socks = offer({ id: 'socks', variantId: 'v-socks' });
    expect(pickOffer([socks], ['v-socks'])).toBeNull();
  });

  it('still refuses when they are already buying it AND its trigger fired', () => {
    const socks = offer({ id: 'socks', variantId: 'v-socks', triggerVariantIds: ['v-boots'] });
    expect(pickOffer([socks], ['v-boots', 'v-socks'])).toBeNull();
  });

  it('returns ONE offer, never a stack of them', () => {
    // A checkout that asks four times is the pattern this feature is known for.
    const picked = pickOffer(
      [offer({ id: 'a', priority: 30 }), offer({ id: 'b', priority: 10 }), offer({ id: 'c' })],
      ['v-mug']
    );
    expect(picked?.id).toBe('b');
  });

  it('picks the lowest priority number, not the first in the list', () => {
    const picked = pickOffer(
      [offer({ id: 'late', priority: 200 }), offer({ id: 'early', priority: 1 })],
      ['v-mug']
    );
    expect(picked?.id).toBe('early');
  });

  it('is stable when two offers tie', () => {
    const list = [offer({ id: 'one', priority: 50 }), offer({ id: 'two', priority: 50 })];
    // The query orders by createdAt, so a tie must not be re-shuffled here —
    // the same basket should see the same offer twice.
    expect(pickOffer(list, ['v-mug'])?.id).toBe('one');
    expect(pickOffer(list, ['v-mug'])?.id).toBe('one');
  });

  it('offers nothing rather than throwing on an empty basket', () => {
    expect(pickOffer([offer({ id: 'a', triggerVariantIds: ['v-mug'] })], [])).toBeNull();
    expect(pickOffer([], ['v-mug'])).toBeNull();
  });

  it('treats an empty trigger list as "anybody", not as "nobody"', () => {
    // The difference between an add-on that appears for every shopper and one
    // that silently never appears at all.
    expect(pickOffer([offer({ id: 'a', triggerVariantIds: [] })], [])?.id).toBe('a');
  });
});
