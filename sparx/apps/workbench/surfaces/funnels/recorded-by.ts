// What records a campaign step, in plain words, so an owner can tell an automatic
// step from one that only counts what they add. Mirrors the worker's rules in
// @wizeworks/funnels advance.ts: a step with a rule is recorded on events, a
// finishing step when the goal comes true, anything else only when told.

import type { FunnelStage, StageMatch } from './data';

/** What each event means to an owner. Unknown events fall back to the rule line. */
const EVENT_WORDS: Record<string, string> = {
  'cart.abandoned': 'somebody leaves a basket without paying',
  'checkout.started': 'they start checking out',
  'order.paid': 'they pay for an order',
  'order.delivered': 'their order is delivered',
  'review.submitted': 'they leave a review',
  'crm.customer.subscribed': 'they sign up for your emails',
  'form.submitted': 'somebody sends a form on your site',
  'crm.engagement.received': 'they write to you',
  'booking.created': 'they book',
};

function eventOf(match: StageMatch | undefined): string | null {
  const first = match?.conditions[0];
  return match?.conditions.length === 1 &&
    first &&
    'field' in first &&
    first.field === 'event.type' &&
    typeof first.value === 'string'
    ? first.value
    : null;
}

export function recordedBy(stage: FunnelStage): string {
  if (stage.kind === 'convert')
    return 'Recorded on its own when the success rule below comes true.';
  if (stage.kind === 'view') return 'Counted from visits to the page below. Nobody is named.';
  const event = eventOf(stage.match);
  if (event && EVENT_WORDS[event]) return `Recorded on its own when ${EVENT_WORDS[event]}.`;
  if (stage.match && stage.match.conditions.length > 0) {
    return 'Recorded on its own when a customer fits this step’s rule.';
  }
  return stage.kind === 'capture'
    ? 'Recorded when somebody sends this campaign’s form, or when you add them.'
    : 'Recorded only when you or a connected tool marks it.';
}
