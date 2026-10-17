// Where a sale came from, in an owner's words (sparx persona issue 265).
//
// The customer reports pane, the REST reports and the AI tools all read these
// labels. They said "Storefront", "Admin", "B2B portal", "Import" and "MCP / AI":
// a retired word, a role, and three pieces of the code's vocabulary, about the
// same orders the console calls "Your website" and "Added by hand".

import { describe, expect, it } from 'vitest';

import { channelDisplayName, channelKeyLabel, ORDER_CHANNEL_LABELS } from './orders';

describe('the order channel words', () => {
  it('are the words the console uses', () => {
    expect(channelKeyLabel('storefront')).toBe('Your website');
    expect(channelKeyLabel('admin')).toBe('Added by hand');
    expect(channelKeyLabel('b2b_portal')).toBe('Wholesale portal');
    expect(channelKeyLabel('import')).toBe('Imported');
    expect(channelKeyLabel('mcp')).toBe('AI assistant');
    expect(channelKeyLabel('pos')).toBe('At the till');
    expect(channelDisplayName('admin')).toBe('Added by hand');
  });

  it('never use a code word, a role or the retired word', () => {
    const words = Object.values(ORDER_CHANNEL_LABELS);
    // The denominator: a table that emptied would pass in silence.
    expect(words.length).toBeGreaterThan(6);
    for (const word of words) {
      expect(word).not.toMatch(/storefront|admin|b2b|mcp|^import$|team/i);
    }
  });
});
