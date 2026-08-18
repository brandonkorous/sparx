// The starter support queue (docs/144 §7).
//
// Applied to a tenant the first time the service surface is used, and freely
// editable afterwards — the same "your own copy, not a shared row" pattern the
// sales pipeline and the built-in segments use.
//
// FOUR STAGES, and the two in the middle are the reason this exists at all. A
// queue split only into "open" and "done" cannot answer the one question a
// support lead asks all day: which of these are waiting on US? "Waiting on
// customer" is where a request goes when the ball is in their court, and
// separating it is what stops a chased-and-unanswered ticket from looking
// identical to one nobody has touched.

import type { PipelineTemplate } from './pipeline';

export const TICKET_PIPELINE_SLUG = 'support';

export const DEFAULT_TICKET_PIPELINE_TEMPLATE: PipelineTemplate = {
  name: 'Support Queue',
  slug: TICKET_PIPELINE_SLUG,
  isDefault: true,
  objectKey: 'ticket',
  stages: [
    // Probability is meaningless on a ticket and stays 0 throughout; it is a
    // sales-forecast field that the shared Pipeline table carries. Colors are
    // the workbench's own module-neutral defaults, overridable per tenant.
    { name: 'New', sortOrder: 0, probability: 0, stageType: 'open', color: '#0EA5E9' },
    { name: 'In Progress', sortOrder: 1, probability: 0, stageType: 'open', color: '#6366F1' },
    {
      name: 'Waiting on Customer',
      sortOrder: 2,
      probability: 0,
      stageType: 'open',
      color: '#F59E0B',
    },
    { name: 'Resolved', sortOrder: 3, probability: 0, stageType: 'resolved', color: '#10B981' },
    { name: 'Closed', sortOrder: 4, probability: 0, stageType: 'closed', color: '#94A3B8' },
  ],
};

export interface SlaTargetTemplate {
  priority: 'low' | 'medium' | 'high' | 'urgent';
  firstResponseMinutes: number | null;
  resolutionMinutes: number | null;
}

export interface SlaPolicyTemplate {
  name: string;
  description: string;
  isDefault: boolean;
  timezone: string;
  businessHours: { day: number; startMinute: number; endMinute: number }[];
  warnAtPercent: number;
  targets: SlaTargetTemplate[];
}

/**
 * The starter promise.
 *
 * MONDAY TO FRIDAY, 9 TO 5, NOT 24/7 — because the overwhelming majority of
 * businesses on this platform are not staffed overnight, and a default that
 * assumes they are would report every weekend as a breach on Monday morning.
 * A business that IS always open clears the hours (an empty pattern means 24/7)
 * and gets the other reading in one edit.
 *
 * The timezone is UTC only as a placeholder the caller replaces: the bootstrap
 * passes the site's own zone where it knows one. A promise measured in a zone
 * the business does not work in is off by hours in both directions.
 *
 * Targets are deliberately unambitious. A first-response promise a business
 * cannot keep is worse than no promise, because it converts every ordinary
 * Tuesday into a wall of red — and the first thing anyone does with a wall of
 * red is stop looking at it.
 */
export const DEFAULT_SLA_POLICY_TEMPLATE: SlaPolicyTemplate = {
  name: 'Standard Support',
  description: 'Weekday business hours. Edit the hours and targets to match how your team works.',
  isDefault: true,
  timezone: 'UTC',
  businessHours: [
    { day: 1, startMinute: 540, endMinute: 1020 },
    { day: 2, startMinute: 540, endMinute: 1020 },
    { day: 3, startMinute: 540, endMinute: 1020 },
    { day: 4, startMinute: 540, endMinute: 1020 },
    { day: 5, startMinute: 540, endMinute: 1020 },
  ],
  warnAtPercent: 80,
  targets: [
    // Business minutes, so "1 day" is one WORKING day (480 minutes), not 24
    // hours of wall clock that mostly elapses while the office is dark.
    { priority: 'urgent', firstResponseMinutes: 60, resolutionMinutes: 480 },
    { priority: 'high', firstResponseMinutes: 240, resolutionMinutes: 960 },
    { priority: 'medium', firstResponseMinutes: 480, resolutionMinutes: 2400 },
    // No promise on low priority, expressed as the absence of one rather than
    // a number nobody intends to meet.
    { priority: 'low', firstResponseMinutes: null, resolutionMinutes: null },
  ],
};
