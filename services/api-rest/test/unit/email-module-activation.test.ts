// Unit coverage for the Email module-activation consumer (docs/82 Slice E4).
//
// Proves the seed gate: a `module.activated` event for the email module calls
// automationService.provisionDefaults exactly once with the event's tenant (and
// a system actor); an activation of any OTHER module is ignored. No DB — the
// email service is mocked and we drive the real in-process platform bus (the same
// singleton api-rest wires in production), so this runs in CI.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// vi.hoisted runs before the hoisted vi.mock factory, so the spy exists when the
// factory references it (a plain const would be in the temporal dead zone).
const { provisionDefaults } = vi.hoisted(() => ({ provisionDefaults: vi.fn() }));
vi.mock('@sparx/email-platform', () => ({
  automationService: { provisionDefaults },
}));

import { resetPlatformBusForTesting, type PlatformEventBus } from '@sparx/crm';

import { registerEmailModuleActivationConsumer } from '../../src/lib/email-module-activation.js';

describe('registerEmailModuleActivationConsumer', () => {
  let bus: PlatformEventBus;
  let teardown: () => void;

  beforeEach(() => {
    // Reset the active bus FIRST, then register — the consumer subscribes to
    // whatever getPlatformBus() returns, so the order pins it to this bus.
    bus = resetPlatformBusForTesting();
    provisionDefaults.mockReset();
    provisionDefaults.mockResolvedValue([]);
    teardown = registerEmailModuleActivationConsumer();
  });

  afterEach(() => teardown());

  it('seeds default email automations when the email module activates', async () => {
    await bus.publish({
      id: 'evt-email',
      topic: 'module.activated',
      tenantId: 'tenant-1',
      occurredAt: new Date('2026-06-11T00:00:00.000Z'),
      payload: { module: 'email' },
    });
    await bus.drain();

    expect(provisionDefaults).toHaveBeenCalledTimes(1);
    expect(provisionDefaults).toHaveBeenCalledWith({ tenantId: 'tenant-1', userId: undefined });
  });

  it('ignores activation of any other module', async () => {
    await bus.publish({
      id: 'evt-crm',
      topic: 'module.activated',
      tenantId: 'tenant-1',
      occurredAt: new Date('2026-06-11T00:00:00.000Z'),
      payload: { module: 'crm' },
    });
    await bus.drain();

    expect(provisionDefaults).not.toHaveBeenCalled();
  });
});
