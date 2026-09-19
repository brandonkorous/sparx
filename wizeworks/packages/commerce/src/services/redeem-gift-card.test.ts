import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * A GIFT CARD SPENT ON AN ORDER THAT SAYS NOBODY PAID.
 *
 * Debiting the card and recording the money were two acts, and only the first
 * one lived in this function. The caller was told to do the second, and a
 * caller forgot: Juniper Row's O-000015 took $150 off Marguerite Adeyemi's card
 * and then read "$659.00 still owed · No money has come in for this order yet",
 * while the gift card screen showed the same $150 as spent on that order. She
 * is asked for money she has already handed over.
 *
 * Checkout was fixed by adding the call beside this one. That fixed one caller;
 * this function still took an `orderId` and still left the obligation outside
 * itself, so the next caller started with the same hole. Both writes belong to
 * one act.
 */
const giftCard = {
  findFirst: vi.fn(),
  update: vi.fn().mockResolvedValue({}),
};
const giftCardTransaction = { create: vi.fn().mockResolvedValue({}) };
const recordPayment = vi.fn().mockResolvedValue({});

vi.mock('@wizeworks/db', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  withTenant: (_ctx: unknown, fn: (tx: unknown) => unknown) =>
    Promise.resolve(fn({ giftCard, giftCardTransaction })),
}));
vi.mock('@wizeworks/crm', () => ({ orderPaymentsService: { recordPayment } }));
vi.mock('../events', () => ({
  publishCommerceEvent: vi.fn().mockResolvedValue(undefined),
  indexCommerceEntity: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../audit', () => ({ writeAuditLog: vi.fn().mockResolvedValue(undefined) }));
vi.mock('./cart-service', () => ({ recomputeCartTotals: vi.fn().mockResolvedValue(undefined) }));

const { redeemGiftCard } = await import('./discount-service');

const CTX = { tenantId: '2e78fb6c-a823-4698-bcb9-58a4f17710a0' };
const CARD = {
  id: 'card-1',
  code: 'QM44-2DTN-6HM4-6RA9',
  balanceCents: 15_000,
  currency: 'USD',
  status: 'active',
  expiresAt: null,
};

beforeEach(() => {
  giftCard.findFirst.mockReset().mockResolvedValue({ ...CARD });
  giftCard.update.mockClear();
  giftCardTransaction.create.mockClear();
  recordPayment.mockClear();
});

describe('redeemGiftCard', () => {
  it('records the money against the order, not just the debit on the card', async () => {
    await redeemGiftCard(CTX, {
      giftCardId: 'card-1',
      deltaCents: 15_000,
      orderId: 'order-15',
    });

    expect(recordPayment).toHaveBeenCalledTimes(1);
    expect(recordPayment.mock.calls[0]?.[1]).toMatchObject({
      orderId: 'order-15',
      processor: 'gift_card',
      processorRef: 'QM44-2DTN-6HM4-6RA9',
      amount: 150,
      currency: 'USD',
      status: 'captured',
    });
  });

  it('records it in the SAME transaction as the debit', async () => {
    // Not a nicety. A card debited against an order that records nothing is
    // money the shopper can neither spend nor get back, so the two have to fail
    // together.
    await redeemGiftCard(CTX, { giftCardId: 'card-1', deltaCents: 4_000, orderId: 'order-16' });
    const ctxPassed = recordPayment.mock.calls[0]?.[0] as { tx?: unknown };
    // The very client the card was debited on, handed straight down.
    expect(ctxPassed.tx).toMatchObject({ giftCard, giftCardTransaction });
  });

  it('still writes the ledger row and moves the balance', async () => {
    await redeemGiftCard(CTX, { giftCardId: 'card-1', deltaCents: 15_000, orderId: 'order-15' });
    expect(giftCard.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { balanceCents: 0, status: 'spent' } })
    );
    expect(giftCardTransaction.create.mock.calls[0]?.[0]).toMatchObject({
      data: { deltaCents: -15_000, reason: 'redeem', orderId: 'order-15' },
    });
  });

  it('takes no money and records none when the card cannot cover it', async () => {
    giftCard.findFirst.mockResolvedValue({ ...CARD, balanceCents: 1_000 });
    await expect(
      redeemGiftCard(CTX, { giftCardId: 'card-1', deltaCents: 15_000, orderId: 'order-15' })
    ).rejects.toThrow();
    expect(giftCard.update).not.toHaveBeenCalled();
    expect(recordPayment).not.toHaveBeenCalled();
  });

  it('refuses a zero or negative debit before touching anything', async () => {
    await expect(
      redeemGiftCard(CTX, { giftCardId: 'card-1', deltaCents: 0, orderId: 'order-15' })
    ).rejects.toThrow();
    expect(recordPayment).not.toHaveBeenCalled();
  });
});
