import { describe, expect, it } from 'vitest';

import { planRevalidation } from '../src/handler.js';

describe('planRevalidation', () => {
  it('maps catalog + review + Q&A events to the commerce scope', () => {
    for (const type of [
      'product.created',
      'product.updated',
      'product.deleted',
      'variant.updated',
      'inventory.adjusted',
      'review.published',
      'question.published',
      'question.answered',
    ]) {
      expect(planRevalidation(type)).toBe('commerce');
    }
  });

  it('maps content + redirect events to the content scope', () => {
    for (const type of [
      'content.entry.published',
      'content.entry.updated',
      'content.entry.unpublished',
      'content_type.upserted',
      'redirect.added',
    ]) {
      expect(planRevalidation(type)).toBe('content');
    }
  });

  it('maps Site Builder publish events to the site scope', () => {
    expect(planRevalidation('sitebuilder.published')).toBe('site');
    expect(planRevalidation('sitebuilder.rolled_back')).toBe('site');
  });

  it('maps Builder / silica publish events to their own builder scope', () => {
    for (const type of [
      'builder.page.published',
      'builder.layout.published',
      'builder.layout.activated',
      'builder.email.published',
    ]) {
      expect(planRevalidation(type)).toBe('builder');
    }
  });

  it('keeps builder and site as SEPARATE scopes', () => {
    // They invalidate different reads and fire on different events: `site:` tags the
    // legacy snapshot + nav menus, `builder:` tags the page/layout/frame/style reads.
    // A page publish is the most frequent write in the system and must not evict the
    // snapshot alongside it (docs/127 §6).
    expect(planRevalidation('builder.page.published')).not.toBe(
      planRevalidation('sitebuilder.published')
    );
  });

  it('returns null for events that touch no cached read', () => {
    for (const type of ['cart.updated', 'order.paid', 'email.send', 'media.uploaded']) {
      expect(planRevalidation(type)).toBeNull();
    }
  });
});
