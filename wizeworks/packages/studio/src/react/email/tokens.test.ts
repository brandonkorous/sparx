import { describe, expect, it } from 'vitest';
import { resolveMergeTags } from './tokens';
import type { EmailPreviewHost } from '../host';

const host: EmailPreviewHost = {
  resolveBinding: (ref) => (ref === 'customer.firstName' ? 'Nadia' : undefined),
  resolveExpression: (expr) => (expr === 'customer.firstName ?? "there"' ? 'there' : undefined),
};

describe('resolveMergeTags', () => {
  it('resolves a bare dotted path through the binding resolver', () => {
    expect(resolveMergeTags('Hi {{customer.firstName}},', host)).toBe('Hi Nadia,');
  });

  it('hands anything that is not a path to the host expression resolver', () => {
    // The whole point of the split: silica owns one production, the app owns the
    // grammar — so the canvas and the send agree about what a fallback means.
    expect(resolveMergeTags('Hi {{customer.firstName ?? "there"}}', host)).toBe('Hi there');
  });

  it('leaves an unrecognized tag exactly as authored', () => {
    // Blanking it would make a typo look like a value that happened to be empty.
    expect(resolveMergeTags('Hi {{custmoer.firstName}}', host)).toBe('Hi {{custmoer.firstName}}');
  });

  it('resolves two tags on one line independently', () => {
    expect(resolveMergeTags('{{customer.firstName}} — {{nope}}', host)).toBe('Nadia — {{nope}}');
  });

  it('leaves text with no tags untouched', () => {
    expect(resolveMergeTags('Thanks for your order', host)).toBe('Thanks for your order');
  });
});
