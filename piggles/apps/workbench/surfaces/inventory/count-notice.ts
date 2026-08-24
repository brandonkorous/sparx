// The one status message a count session shows — the most specific true thing
// about where it stands right now. One message, not a stack: the stage the count
// is at is the one thing the operator needs.

import { formatCents } from './data';
import type { CountDetail } from './counts-data';

export interface CountNotice {
  tone: 'success' | 'warning' | 'info' | 'danger';
  title: string;
  body: string;
}

export function buildNotice(count: CountDetail): CountNotice | null {
  switch (count.status) {
    case 'review':
      return count.requiresApproval
        ? {
            tone: 'warning',
            title: 'A manager needs to approve this',
            body: `The differences add up to ${formatCents(
              count.varianceValueCents
            )}, which is over your review limit of ${formatCents(
              count.approvalThresholdCents
            )}. A manager has to approve it before the corrections can be applied.`,
          }
        : {
            tone: 'info',
            title: 'Ready to apply',
            body: 'Counting is finished. Applying this will correct your stock numbers to match what was counted.',
          };
    case 'approved':
      return {
        tone: 'info',
        title: 'Approved — ready to apply',
        body: 'A manager has signed this off. Apply it to correct your stock numbers to match what was counted.',
      };
    case 'posted':
      return {
        tone: 'success',
        title: 'Applied',
        body: 'Your stock numbers were corrected to match this count. Every change is in the movement history, and nothing further is needed.',
      };
    case 'cancelled':
      return {
        tone: 'info',
        title: 'Discarded',
        body: 'This count was closed without applying anything. No stock was changed.',
      };
    default:
      return null;
  }
}
