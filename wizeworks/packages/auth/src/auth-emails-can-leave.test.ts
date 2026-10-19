// Sparx persona issue 337: with no event broker, "Send the link again" said a
// link was on its way and nothing was sent, because Better Auth swallows what
// the send callback throws. The console now asks this first.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The publisher is made once per process, so each case loads a fresh one.
const canLeave = async (): Promise<boolean> =>
  (await import('./email-events')).authEmailsCanLeave();

const saved = { ...process.env };

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  process.env = { ...saved };
});

describe('authEmailsCanLeave', () => {
  it('says no when this process discards its events', async () => {
    delete process.env.EVENT_BROKER;
    delete process.env.SPARX_DEV_WORKER_ROUTES;
    process.env.NODE_ENV = 'development';
    expect(await canLeave()).toBe(false);
  });

  it('says yes when the events go to a broker', async () => {
    process.env.EVENT_BROKER = 'nats';
    process.env.EVENT_BROKER_URL = 'nats://localhost:4222';
    expect(await canLeave()).toBe(true);
  });
});
