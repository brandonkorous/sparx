import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  _resetTenantStateCache,
  dispatch,
  type EngineDeps,
  type TenantCtx,
} from '@wizeworks/automation';
import type { ActionType } from '@wizeworks/automation-schemas';
import { getDefaultEmailTemplate } from '@wizeworks/builder-schemas';

// Sparx persona issue 087. Order confirmations always send, whether or not the
// business has the email module: a buyer must always be told their order went
// through. The confirmation is a system automation whose step is
// `email.send_campaign`, and that action was gated on the email module, so a shop
// selling without it confirmed nothing on a pay-later order or a held one.
//
// The rule now: a transactional send (one a customer gets because of something
// they did) is never stopped by the email module; the email module still gates
// what it is for, campaigns and marketing. These drive the real gate chain and
// the real executor through `dispatch`, over a tenant row with the email module
// on or off. Suppression is untouched and lives in `enqueueSend`, mocked here.

const enqueueSend = vi.fn(() => Promise.resolve({ enqueued: true, suppressed: false }));
vi.mock('@wizeworks/email-sends', () => ({
  enqueueSend: (...args: unknown[]) => enqueueSend(...(args as [])) as unknown,
}));

const { installEmailActions } = await import('./email.js');
const { installSequenceActions } = await import('./sequences.js');
const { SYSTEM_AUTOMATIONS } = await import('./seeds/index.js');
const { COMMERCE_ABANDONED_CART_NUDGE, COMMERCE_ORDER_CONFIRMATION_EMAIL } =
  await import('./seeds/commerce.js');
const { CRM_WELCOME_NEW_CUSTOMER } = await import('./seeds/crm.js');
const { CHAT_SATISFACTION_SURVEY } = await import('./seeds/chat.js');

const noop = (): void => undefined;
const deps: EngineDeps = {
  publisher: { publish: () => Promise.resolve() },
  logger: { debug: noop, info: noop, warn: noop, error: noop },
};

/** A shop's tenant row, as the gate chain reads it, with email on or off. */
function shop(emailOn: boolean): TenantCtx {
  const settings = {
    modules: { commerce: { enabled: true }, crm: { enabled: true }, email: { enabled: emailOn } },
  };
  const tx = {
    tenant: { findUnique: () => Promise.resolve({ status: 'active', settings }) },
  };
  return {
    tenantId: emailOn ? 'tenant-with-email' : 'tenant-without-email',
    tx: tx as unknown as TenantCtx['tx'],
    deps,
    causeDepth: 0,
  };
}

/** What the trigger resolved: a buyer with an address, and the order they placed. */
const fields = {
  'customer.id': 'cust-amara',
  'customer.email': 'amara.okafor@example.test',
  'customer.doNotContact': false,
  'order.id': 'order-2041',
  propertyId: 'site-copperleaf',
};

async function step(emailOn: boolean, type: string, config: Record<string, unknown>) {
  return dispatch(shop(emailOn), type as ActionType, config, fields);
}

/** The built-in email each enqueued send names, in order. */
function sentKeys(): (string | undefined)[] {
  return enqueueSend.mock.calls.map((call) => {
    const spec = (call as unknown[])[1] as { body: { defer?: { builderEmailKey?: string } } };
    return spec.body.defer?.builderEmailKey;
  });
}

beforeAll(() => {
  installEmailActions();
  installSequenceActions();
});

beforeEach(() => {
  enqueueSend.mockClear();
  _resetTenantStateCache();
});

const confirmation = COMMERCE_ORDER_CONFIRMATION_EMAIL.actions[0]!;

describe('an order confirmation', () => {
  it('sends with the email module off', async () => {
    const outcome = await step(false, confirmation.type, confirmation.config);
    expect(outcome.kind).toBe('completed');
    expect(sentKeys()).toEqual(['order-confirmation']);
    // Transactional scope, so a marketing unsubscribe still does not withhold it,
    // exactly as before.
    expect(enqueueSend.mock.calls[0]).toEqual([
      expect.anything(),
      expect.objectContaining({ recipient: fields['customer.email'], scope: 'transactional' }),
    ]);
  });

  it('sends with the email module on', async () => {
    const outcome = await step(true, confirmation.type, confirmation.config);
    expect(outcome.kind).toBe('completed');
    expect(sentKeys()).toEqual(['order-confirmation']);
  });
});

describe('a campaign or marketing send', () => {
  const abandonedCart = COMMERCE_ABANDONED_CART_NUDGE.actions[0]!;
  const marketing: [string, string, Record<string, unknown>][] = [
    ['a marketing built-in (abandoned cart)', abandonedCart.type, abandonedCart.config],
    [
      'a broadcast the business designed',
      'email.send_campaign',
      { builderEmailId: '9d2f1c4e-6a1b-4c8e-9f3a-2b7d5e8c1a40', subject: 'Fall sale' },
    ],
    ['a coded campaign template', 'email.send_campaign', { template: 'welcome-series' }],
    ['adding someone to a sequence', 'email.sequence_add', { sequenceId: 'seq-fall' }],
  ];

  it.each(marketing)('%s is still blocked with the email module off', async (_n, type, config) => {
    const outcome = await step(false, type, config);
    expect(outcome).toMatchObject({
      kind: 'gated',
      gate: 'module-active',
      reason: 'module_inactive_email',
    });
    expect(enqueueSend).not.toHaveBeenCalled();
  });

  it('a marketing built-in sends once the email module is on', async () => {
    const outcome = await step(true, abandonedCart.type, abandonedCart.config);
    expect(outcome.kind).toBe('completed');
    expect(sentKeys()).toEqual(['abandoned-cart']);
  });
});

// Brandon, 2026-10-03. The welcome and the chat survey were declared
// transactional long ago, for the suppression scope, which under the rule above
// would send them with the email module off: a CRM-only business would welcome
// every contact it typed in, and a survey would ignore an unsubscribe. Neither is
// something the customer needs because of something they did, so both are
// marketing. Pinned by name, because the per-seed loop below follows whatever a
// seed declares and would stay green if either were declared transactional again.
describe('the welcome and the chat survey are marketing', () => {
  const welcome = CRM_WELCOME_NEW_CUSTOMER.actions[0]!;
  const survey = CHAT_SATISFACTION_SURVEY.actions[0]!;
  const both: [string, string, Record<string, unknown>, string][] = [
    ['the welcome', welcome.type, welcome.config, 'welcome-customer'],
    ['the chat survey', survey.type, survey.config, 'chat-satisfaction'],
  ];

  it.each(both)('%s is held with the email module off', async (_n, type, config) => {
    const outcome = await step(false, type, config);
    expect(outcome).toMatchObject({
      kind: 'gated',
      gate: 'module-active',
      reason: 'module_inactive_email',
    });
    expect(enqueueSend).not.toHaveBeenCalled();
  });

  it.each(both)(
    '%s sends with the email module on, in marketing scope',
    async (_n, type, config, key) => {
      const outcome = await step(true, type, config);
      expect(outcome.kind).toBe('completed');
      expect(sentKeys()).toEqual([key]);
      // Marketing scope is what makes a marketing-only unsubscribe withhold it.
      expect(enqueueSend.mock.calls[0]).toEqual([
        expect.anything(),
        expect.objectContaining({ scope: 'marketing' }),
      ]);
    }
  );

  it.each(both)('%s skips a contact flagged do not contact', async (_n, type, config) => {
    const outcome = await dispatch(shop(true), type as ActionType, config, {
      ...fields,
      'customer.doNotContact': true,
    });
    expect(outcome.kind).toBe('completed');
    expect(enqueueSend).not.toHaveBeenCalled();
  });
});

describe('every system automation that sends an email', () => {
  // The same rule for all of them, from the type each step declares: the
  // receipts, invoices, approvals and bookings send without the email module,
  // and the marketing ones wait for it.
  const campaignSteps = SYSTEM_AUTOMATIONS.flatMap(({ spec }) =>
    spec.actions
      .filter((a) => a.type === 'email.send_campaign')
      .map((a) => ({ name: spec.name, config: a.config }))
  );
  const declared = (config: Record<string, unknown>) =>
    (config as { emailType?: string }).emailType ?? 'marketing';

  it('covers both kinds', () => {
    const kinds = new Set(campaignSteps.map(({ config }) => declared(config)));
    expect([...kinds].sort()).toEqual(['marketing', 'transactional']);
  });

  // The type is written twice: on the seed's step, which decides the gate and the
  // suppression scope, and on the built-in email it sends, which says what that
  // email is. The welcome and the survey were reclassified on 2026-10-03; a later
  // change to one side alone would leave the two disagreeing about one email.
  it('declares the same type as the built-in email it sends', () => {
    const mismatched = campaignSteps.flatMap(({ name, config }) => {
      const key = (config as { builderEmailKey?: string }).builderEmailKey;
      if (!key) return [];
      const template = getDefaultEmailTemplate(key);
      return template?.type === declared(config)
        ? []
        : [`${name}: ${declared(config)} step, ${template?.type ?? 'no'} email`];
    });
    expect(mismatched).toEqual([]);
  });

  it('a transactional one sends with the email module off; a marketing one is held', async () => {
    for (const { name, config } of campaignSteps) {
      _resetTenantStateCache();
      const outcome = await step(false, 'email.send_campaign', config);
      expect(outcome.kind, name).toBe(declared(config) === 'transactional' ? 'completed' : 'gated');
    }
  });
});

// One confirmation per order, on every path a business takes money. Each path is
// the events it publishes, in order: checkout announces `order.placed` only for an
// order that is not held (checkout-service); the sign-off announces it for a held
// one (`placedEvents` in @wizeworks/b2b, pinned in approval-account-signs.test.ts);
// the payment webhook announces `payment.captured` and `order.paid` and sends no
// confirmation of its own (held-card-webhook.test.ts in api-rest). Every system
// automation listening on each event runs here through the real gate chain.
describe('one confirmation per order', () => {
  const paths: [string, string[]][] = [
    ['paid by card at checkout', ['order.placed', 'payment.captured', 'order.paid']],
    [
      'pay later (on terms, or in person)',
      ['order.placed', 'order.payment.recorded', 'order.paid'],
    ],
    [
      'held for sign-off, then approved and charged',
      [
        'b2b.order.pending_approval',
        'b2b.order.approved',
        'order.placed',
        'payment.captured',
        'order.paid',
      ],
    ],
  ];

  async function confirmationsFor(emailOn: boolean, events: string[]): Promise<number> {
    for (const eventType of events) {
      for (const { spec } of SYSTEM_AUTOMATIONS) {
        if (spec.trigger.kind !== 'event' || spec.trigger.eventType !== eventType) continue;
        for (const a of spec.actions) {
          if (!a.type.startsWith('email.send_campaign')) continue;
          await step(emailOn, a.type, a.config);
        }
      }
    }
    return sentKeys().filter((key) => key === 'order-confirmation').length;
  }

  for (const [emailOn, label] of [
    [false, 'off'],
    [true, 'on'],
  ] as const) {
    it.each(paths)(`%s, email module ${label}: exactly one`, async (_path, events) => {
      expect(await confirmationsFor(emailOn, events)).toBe(1);
    });
  }
});
