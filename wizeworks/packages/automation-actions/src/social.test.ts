import { describe, expect, it } from 'vitest';

import {
  buildSocialDraft,
  deriveSocialPostState,
  isAutoApprove,
  parseSocialPostConfig,
} from './social.js';

// The social.post action's pure core (docs/133 §9). The DB write lives in the
// executor; here we lock the config parsing, the draft composition from the
// resolver's `announce.*` fields, and the approval-vs-schedule state machine.

const ANNOUNCE = {
  'announce.title': 'Aurora Down Jacket',
  'announce.summary': 'Warm, packable, weatherproof.',
  'announce.url': 'https://shop.example.com/products/aurora-down-jacket',
  'announce.imageAssetId': '11111111-2222-4333-8444-555555555555',
  'announce.sourceType': 'product',
  'announce.sourceRef': 'prod_123',
  'announce.propertyId': 'site_abc',
};

describe('parseSocialPostConfig', () => {
  it('defaults an empty config', () => {
    expect(parseSocialPostConfig({})).toEqual({});
  });
  it('keeps a template + accepts a string autoApprove', () => {
    const c = parseSocialPostConfig({ template: '{{announce.title}}', autoApprove: 'auto' });
    expect(c.template).toBe('{{announce.title}}');
    expect(c.autoApprove).toBe('auto');
  });
});

describe('isAutoApprove', () => {
  it('is true for the boolean, and the strings the select stores', () => {
    for (const v of [true, 'auto', 'true', 'yes'] as const) {
      expect(isAutoApprove({ autoApprove: v })).toBe(true);
    }
  });
  it('is false by default and for the review-first option', () => {
    for (const v of [undefined, false, '', 'no'] as const) {
      expect(isAutoApprove({ autoApprove: v })).toBe(false);
    }
  });
});

describe('buildSocialDraft', () => {
  it('defaults the body to the announce headline, attaching link + image', () => {
    const d = buildSocialDraft({}, ANNOUNCE);
    expect(d.body).toBe('Aurora Down Jacket');
    expect(d.link).toBe('https://shop.example.com/products/aurora-down-jacket');
    expect(d.mediaAssetIds).toEqual(['11111111-2222-4333-8444-555555555555']);
    expect(d.source).toBe('product');
    expect(d.sourceRef).toBe('prod_123');
    expect(d.propertyId).toBe('site_abc');
  });

  it('interpolates a custom template', () => {
    const d = buildSocialDraft({ template: 'New arrival — {{announce.title}}' }, ANNOUNCE);
    expect(d.body).toBe('New arrival — Aurora Down Jacket');
  });

  it('drops the link + image when told to', () => {
    const d = buildSocialDraft({ includeLink: false, includeImage: false }, ANNOUNCE);
    expect(d.link).toBeNull();
    expect(d.mediaAssetIds).toEqual([]);
  });

  it('lets config.source override the announce source type', () => {
    expect(buildSocialDraft({ source: 'campaign' }, ANNOUNCE).source).toBe('campaign');
  });

  it('falls back to source=automation and empties optional fields when unresolved', () => {
    const d = buildSocialDraft({ template: 'Hello' }, {});
    expect(d.body).toBe('Hello');
    expect(d.link).toBeNull();
    expect(d.mediaAssetIds).toEqual([]);
    expect(d.source).toBe('automation');
    expect(d.sourceRef).toBeNull();
    expect(d.propertyId).toBeNull();
  });

  it('yields an empty body when the headline is missing (executor rejects this)', () => {
    expect(buildSocialDraft({}, {}).body).toBe('');
  });
});

describe('deriveSocialPostState', () => {
  const now = new Date('2026-07-23T12:00:00.000Z');
  it('parks in the approval inbox by default', () => {
    expect(deriveSocialPostState(false, now)).toEqual({
      status: 'pending_approval',
      scheduledAt: null,
      approvedAt: null,
    });
  });
  it('schedules at now when auto-approved', () => {
    expect(deriveSocialPostState(true, now)).toEqual({
      status: 'scheduled',
      scheduledAt: now,
      approvedAt: now,
    });
  });
});
