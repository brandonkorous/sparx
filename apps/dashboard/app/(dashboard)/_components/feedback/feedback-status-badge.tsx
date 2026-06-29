'use client';

import { Badge } from '@sparx/ui';
import { FEEDBACK_STATUS_LABELS, type FeedbackStatus } from '../../_shell/feedback-types';

// Status is its own color axis (DESIGN.md Semantic-Status rule): a feedback
// status renders as a soft semantic Badge, never a neutral pill or hand-rolled
// span. `statusTone()` from @sparx/ui doesn't know these lifecycle values, so we
// map them explicitly to ColorKeys here.
const TONE: Record<FeedbackStatus, string> = {
  new: 'info',
  triaged: 'neutral',
  planned: 'primary',
  in_progress: 'info',
  shipped: 'success',
  declined: 'neutral',
  answered: 'success',
};

export function FeedbackStatusBadge({
  status,
  size = 'sm',
}: {
  status: FeedbackStatus;
  size?: 'sm' | 'md' | 'lg';
}) {
  return (
    <Badge color={TONE[status]} variant="soft" size={size}>
      {FEEDBACK_STATUS_LABELS[status]}
    </Badge>
  );
}
