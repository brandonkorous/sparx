import { describe, expect, it } from 'vitest';

import { DEFAULT_EMAIL_TEMPLATES, getDefaultEmailTemplate } from './default-emails';
import { BuilderNodeSchema, type BuilderNode } from './node';

// Walk a tree, yielding every node (depth-first).
function* walk(node: BuilderNode): Generator<BuilderNode> {
  yield node;
  for (const child of node.children ?? []) yield* walk(child);
}

const types = (root: BuilderNode): string[] => [...walk(root)].map((nd) => nd.type);

describe('DEFAULT_EMAIL_TEMPLATES', () => {
  it('ships exactly the 39 documented templates with unique keys', () => {
    const keys = DEFAULT_EMAIL_TEMPLATES.map((t) => t.key);
    expect(keys).toHaveLength(39);
    expect(new Set(keys).size).toBe(39);
    expect(keys).toEqual(
      expect.arrayContaining([
        'welcome-customer',
        'win-back',
        'abandoned-cart',
        'post-purchase-review',
        'b2b-account-approved',
        'b2b-quote-received',
        'b2b-invoice-due',
        'b2b-quote-expiring',
        'invoicing-reminder',
        'invoicing-overdue',
        'invoicing-overdue-2',
        'invoicing-overdue-final',
        'invoicing-receipt',
        'chat-satisfaction',
        // docs/93 — folded in from coded templates
        'order-confirmation',
        'shipping-confirmation',
        // docs/implementation/transactional-email §4 P1 — order lifecycle
        'order-delivered',
        'order-cancelled',
        'order-refunded',
        'payment-failed',
        // §4 P2 — commerce subscription lifecycle
        'subscription-confirmed',
        'subscription-renewed',
        'subscription-payment-failed',
        // docs/142 — the two collection outcomes that are not failures
        'subscription-authentication-required',
        'subscription-invoice',
        'subscription-paused',
        'subscription-resumed',
        'subscription-cancelled',
        // §4 P3 — returns / RMA + B2B order outcomes
        'return-approved',
        'return-received',
        'return-refunded',
        'b2b-order-approved',
        'b2b-order-rejected',
        // docs/79 — Scheduling module booking notifications (the legacy B2B-fleet
        // appointment-* templates were retired 2026-07-14, docs/79 §15.7)
        'booking-confirmation',
        'booking-reminder',
        'booking-rescheduled',
        'booking-cancelled',
        'waitlist-offer',
        // owner-facing new-booking alert (host, else the site inbox)
        'booking-notification-internal',
      ])
    );
  });

  it('every tree is a valid BuilderNode with unique node ids', () => {
    for (const t of DEFAULT_EMAIL_TEMPLATES) {
      expect(() => BuilderNodeSchema.parse(t.tree), t.key).not.toThrow();
      const ids = [...walk(t.tree)].map((nd) => nd.id);
      expect(new Set(ids).size, `${t.key} ids unique`).toBe(ids.length);
      // The body root is a Section; the renderer wraps it in the branded frame.
      expect(t.tree.type).toBe('Section');
    }
  });

  it('marketing templates carry the compliance pair; transactional carry neither', () => {
    for (const t of DEFAULT_EMAIL_TEMPLATES) {
      const nodeTypes = types(t.tree);
      const hasUnsub = nodeTypes.includes('unsubscribe_link');
      const hasAddr = nodeTypes.includes('physical_address');
      if (t.type === 'marketing') {
        expect(hasUnsub, `${t.key} unsubscribe`).toBe(true);
        expect(hasAddr, `${t.key} address`).toBe(true);
      } else {
        expect(hasUnsub, `${t.key} no unsubscribe`).toBe(false);
        expect(hasAddr, `${t.key} no address`).toBe(false);
      }
    }
  });

  it('subjects and preheaders are present on every template', () => {
    for (const t of DEFAULT_EMAIL_TEMPLATES) {
      expect(t.subject.length, t.key).toBeGreaterThan(0);
      expect(t.preheader.length, t.key).toBeGreaterThan(0);
      expect(t.sources.length, t.key).toBeGreaterThan(0);
    }
  });

  it('getDefaultEmailTemplate looks up by key', () => {
    expect(getDefaultEmailTemplate('welcome-customer')?.type).toBe('transactional');
    expect(getDefaultEmailTemplate('abandoned-cart')?.type).toBe('marketing');
    expect(getDefaultEmailTemplate('nope')).toBeUndefined();
  });
});
