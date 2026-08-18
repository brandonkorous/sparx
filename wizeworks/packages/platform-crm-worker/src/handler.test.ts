import { beforeEach, describe, expect, it, vi } from 'vitest';

// vi.hoisted so the mock factory (itself hoisted above the imports) can close
// over the same spies the assertions read.
const { mirrorTenant, recordSubscriptionChange, recordModuleChange } = vi.hoisted(() => ({
  mirrorTenant: vi.fn(),
  recordSubscriptionChange: vi.fn(),
  recordModuleChange: vi.fn(),
}));

vi.mock('@wizeworks/platform-crm', () => ({
  mirrorTenant,
  recordSubscriptionChange,
  recordModuleChange,
}));

const { handle, parseEvent } = await import('./handler.js');

// pino's child() is the only method the handler touches.
const logger = { child: () => logger } as never;

const OK = { status: 'mirrored', customerId: 'c1', dealId: 'd1', created: true, stage: 'trial' };

function envelope(type: string, data: Record<string, unknown> = {}) {
  return { type, tenantId: 't1', actorId: null, occurredAt: '2026-07-29T00:00:00.000Z', data };
}

beforeEach(() => {
  vi.clearAllMocks();
  mirrorTenant.mockResolvedValue(OK);
  recordSubscriptionChange.mockResolvedValue(OK);
  recordModuleChange.mockResolvedValue(OK);
});

describe('parseEvent', () => {
  it('accepts every topic the worker subscribes to', () => {
    for (const type of [
      'tenant.created',
      'tenant.updated',
      'tenant.subscription.changed',
      'module.activated',
      'module.deactivated',
    ]) {
      expect(parseEvent(envelope(type))?.type).toBe(type);
    }
  });

  it('rejects topics it does not handle, so index acks instead of retrying', () => {
    expect(parseEvent(envelope('order.paid'))).toBeNull();
  });

  it('rejects an envelope with no tenant', () => {
    expect(parseEvent({ type: 'tenant.created', data: {} })).toBeNull();
  });

  it('defaults a missing data block rather than failing the message', () => {
    expect(parseEvent({ type: 'tenant.created', tenantId: 't1' })?.data).toEqual({});
  });
});

describe('handle', () => {
  it('mirrors on both create and update — one operation either way', async () => {
    await handle(parseEvent(envelope('tenant.created'))!, logger);
    await handle(parseEvent(envelope('tenant.updated'))!, logger);
    expect(mirrorTenant).toHaveBeenCalledTimes(2);
    expect(mirrorTenant.mock.calls[0]?.[0]).toBe('t1');
  });

  it('passes the billing figures through to the subscription path', async () => {
    const event = parseEvent(
      envelope('tenant.subscription.changed', { status: 'active', mrrCents: 4900, currency: 'usd' })
    )!;
    await handle(event, logger);
    expect(recordSubscriptionChange).toHaveBeenCalledWith(
      't1',
      { status: 'active', mrrCents: 4900, currency: 'usd' },
      expect.anything()
    );
  });

  it('normalizes a missing amount to null instead of undefined', async () => {
    const event = parseEvent(envelope('tenant.subscription.changed', { status: 'past_due' }))!;
    await handle(event, logger);
    expect(recordSubscriptionChange).toHaveBeenCalledWith(
      't1',
      { status: 'past_due', mrrCents: null, currency: null },
      expect.anything()
    );
  });

  it('maps the two module topics onto one action flag', async () => {
    await handle(parseEvent(envelope('module.activated', { module: 'commerce' }))!, logger);
    await handle(parseEvent(envelope('module.deactivated', { module: 'commerce' }))!, logger);
    expect(recordModuleChange.mock.calls[0]?.[1]).toEqual({
      module: 'commerce',
      action: 'activated',
    });
    expect(recordModuleChange.mock.calls[1]?.[1]).toEqual({
      module: 'commerce',
      action: 'deactivated',
    });
  });

  it('throws on a malformed payload so Pub/Sub redelivers', async () => {
    const event = parseEvent(envelope('tenant.subscription.changed', {}))!;
    await expect(handle(event, logger)).rejects.toThrow();
  });
});
