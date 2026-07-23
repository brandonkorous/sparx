// Social system-automation seeds (docs/133 §11, docs/134 Slice 7). Ship on Social
// activation — but PAUSED (disabled), so the value is visible immediately in the
// tenant's automations list while nothing fires until they connect an account,
// pick targets, and turn the rule on. Both draft into `pending_approval` (the
// default — the automation drafts, a human ships from the Approvals inbox), so a
// tenant can trust them before enabling auto-approve.
//
// The `social.post` action is module-gated to `social`; the body composes the
// resolver's shared `announce.*` fields (title/url/hero image) so the same action
// works whether a product went live or an article published.

import type { SystemAutomationSpec } from '@sparx/automation';

/** Draft a launch post when a product goes live (`product.published`). Seeded
 *  paused — the tenant connects an account, picks targets, then turns it on. */
export const SOCIAL_ANNOUNCE_PRODUCT: SystemAutomationSpec = {
  name: 'Announce new product',
  description:
    'Drafts a social post when you publish a new product, and drops it in your Approvals inbox to review before it goes out. Off by default — connect a social account, pick where to post, then turn it on.',
  trigger: { kind: 'event', eventType: 'product.published' },
  conditions: { logic: 'AND', conditions: [] },
  actions: [{ type: 'social.post', config: { template: 'New arrival — {{announce.title}}' } }],
  locked: false,
  status: 'paused',
};

/** Draft an announcement when an article/blog post publishes
 *  (`content.entry.published`). Seeded paused — opt-in like the product one. */
export const SOCIAL_ANNOUNCE_BLOG: SystemAutomationSpec = {
  name: 'Announce new blog post',
  description:
    'Drafts a social post when you publish a new article, ready in your Approvals inbox to review before it goes out. Off by default — connect a social account, pick where to post, then turn it on.',
  trigger: { kind: 'event', eventType: 'content.entry.published' },
  conditions: { logic: 'AND', conditions: [] },
  actions: [{ type: 'social.post', config: { template: 'New on the blog — {{announce.title}}' } }],
  locked: false,
  status: 'paused',
};
