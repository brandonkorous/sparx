// A send that asks to go out as the business (sparx persona issue 171).
//
// The dropship worker emails a supplier the order a customer placed, and it
// cannot resolve the business's From and Reply-To itself: that lives in
// email-platform, which only this worker carries. So the send says
// `sendAs: 'tenant'` and the From is filled here. A supplier who got the order
// from the platform's address would be dealing with a company they have never
// heard of, and their reply would go nowhere (sparx persona issue 071).

import { describe, expect, it } from 'vitest';
import { asTheBusiness } from '../send-as.js';
import { TemplateSendSchema } from '../template-schema.js';

const order = {
  template: 'purchase-order-sent' as const,
  to: 'orders@sbfilters.test',
  props: {
    fromName: 'Gillett Diesel Service',
    supplierName: 'S&B Filters',
    documentNumber: 'O-000023',
    total: 1100,
    currency: 'USD',
    shipTo: { name: 'Renée Castañeda', lines: ['1 Main St'] },
    lines: [],
    summary: [],
  },
};

describe('asTheBusiness', () => {
  it('puts the business on the From and the Reply-To', () => {
    const out = asTheBusiness(order, {
      from: 'Gillett Diesel Service <gillett@sparx.email>',
      replyTo: 'doty@gillettdiesel.test',
    });
    expect(out.from).toBe('Gillett Diesel Service <gillett@sparx.email>');
    expect(out.replyTo).toBe('doty@gillettdiesel.test');
  });

  it('invites a reply only when one reaches the business', () => {
    const answered = asTheBusiness(order, { from: 'G <g@x.test>', replyTo: 'doty@x.test' });
    expect(answered.props.canReply).toBe(true);
    const unanswered = asTheBusiness(order, { from: 'G <g@x.test>', replyTo: null });
    expect(unanswered.props.canReply).toBe(false);
    expect(unanswered.replyTo).toBeUndefined();
  });

  it('leaves alone what the send already said', () => {
    const out = asTheBusiness(
      { ...order, replyTo: 'parts@x.test', props: { ...order.props, canReply: false } },
      { from: 'G <g@x.test>', replyTo: 'doty@x.test' }
    );
    expect(out.replyTo).toBe('parts@x.test');
    expect(out.props.canReply).toBe(false);
  });

  it('is let through the delivery gate', () => {
    const parsed = TemplateSendSchema.safeParse({ ...order, sendAs: 'tenant' });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.sendAs).toBe('tenant');
  });
});
