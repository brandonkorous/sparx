import type { TriggerEventDef } from './types';

export const OPERATIONS_TRIGGER_EVENTS: readonly TriggerEventDef[] = [
  // ── Email ──
  { eventType: 'email.opened', label: 'A marketing email is opened', module: 'email' },
  { eventType: 'email.clicked', label: 'A link in an email is clicked', module: 'email' },
  { eventType: 'email.bounced', label: 'A marketing email bounces', module: 'email' },
  // A reply to something YOU sent (what a follow-up exits on), unlike "a customer replies or
  // writes in", which includes cold inbound mail a nurture rule must not treat as engagement.
  { eventType: 'email.replied', label: 'Somebody replies to an email you sent', module: 'email' },
  // ── Your team (docs/149) ──
  // The nightly sweep publishes an expiring license but sends no mail, so the owner decides
  // who hears in a rule; the trigger must be offered here or it may as well not exist.
  {
    eventType: 'staff.certification.expiring',
    label: 'Someone’s license or certificate is running out',
    module: 'staff',
  },
  { eventType: 'staff.member.created', label: 'Somebody joins the team', module: 'staff' },
  { eventType: 'staff.timeoff.requested', label: 'Somebody asks for time off', module: 'staff' },
  {
    eventType: 'staff.timeoff.decided',
    label: 'A time-off request is approved or declined',
    module: 'staff',
  },
  { eventType: 'staff.time.approved', label: 'A timesheet is approved', module: 'staff' },
  // ── Money going out (docs/148) ──
  {
    eventType: 'finance.expense.recorded',
    label: 'A cost is recorded',
    module: 'finance',
  },
  {
    eventType: 'finance.accounting.sync.completed',
    label: 'A hand-off to your accounting system finishes',
    module: 'finance',
  },
  // ── Dropshipping ──
  // The supplier's tracking is the ONLY signal on a dropship order, so these two are the
  // whole of "where is my order" (published by the tracking poll).
  {
    eventType: 'dropship.order.shipped',
    label: 'A supplier ships a dropship order',
    module: 'dropship',
  },
  {
    eventType: 'dropship.order.delivered',
    label: 'A dropship order is delivered',
    module: 'dropship',
  },
  // ── Social ──
  // `revoked` is somebody UNLINKING; `expired` (health sweep) is a broken grant. A rule that
  // emails "reconnect your account" must fire on the second.
  {
    eventType: 'social.connection.added',
    label: 'A social account is connected',
    module: 'social',
  },
  {
    eventType: 'social.connection.revoked',
    label: 'A social account is disconnected',
    module: 'social',
  },
  {
    eventType: 'social.connection.expired',
    label: 'A social account needs reconnecting',
    module: 'social',
  },
  // ── Campaigns (docs/151) ──
  // Let an automation REACT to a campaign. `entered` fires when somebody first says who they
  // are (never on a page view); `abandoned` fires from a nightly sweep when they STOP.
  {
    eventType: 'funnel.entered',
    label: 'Somebody enters a campaign',
    module: 'funnels',
  },
  {
    eventType: 'funnel.converted',
    label: 'Somebody finishes a campaign',
    module: 'funnels',
  },
  {
    eventType: 'funnel.abandoned',
    label: 'Somebody goes quiet in a campaign',
    module: 'funnels',
  },
];
