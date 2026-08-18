'use client';

// Shared presentation for the feedback UI — kept in one place so the compose
// form, the history list, and the thread agree on icons, titles, and tone.

import { Badge } from '@wizeworks/silicaui-react';
import {
  faCircleQuestion,
  faExclamationTriangle,
  faHeart,
  faLightbulb,
} from '@fortawesome/pro-solid-svg-icons';
import type { PigglesIcon } from '@piggles/ui';
import {
  FEEDBACK_STATUS_LABELS,
  type FeedbackCategory,
  type FeedbackStatus,
  type FeedbackSubmission,
} from '../../lib/api/feedback';

export const CATEGORY_ICON: Record<FeedbackCategory, PigglesIcon> = {
  idea: faLightbulb,
  problem: faExclamationTriangle,
  question: faCircleQuestion,
  praise: faHeart,
};

/**
 * Each category wears its own semantic hue, so the picker reads at a glance
 * rather than as four identical buttons: idea is the primary suggestion,
 * problem takes warning (matching its triangle), question is informational,
 * praise is a success. Color by MEANING — never for decoration.
 */
export const CATEGORY_COLOR: Record<FeedbackCategory, 'primary' | 'warning' | 'info' | 'success'> =
  {
    idea: 'primary',
    problem: 'warning',
    question: 'info',
    praise: 'success',
  };

/**
 * Status is its own color axis, and this ladder reads as PROGRESS: arrived →
 * parked → committed → moving → done.
 *
 * Two deliberate exclusions. `primary` is the sparx ember (#e04631), which sits
 * one hue-step from danger — a "Planned" pill in it reads as rejected next to a
 * green "Shipped", which is the opposite of the news. And nothing here is red at
 * all: no lifecycle state of a person's suggestion is a failure. `declined`
 * especially stays neutral — turning someone's idea down is not an error, and
 * painting it in alarm colors would be gratuitously harsh to the person who
 * took the trouble to send it.
 */
const STATUS_COLOR: Record<FeedbackStatus, 'info' | 'neutral' | 'accent' | 'warning' | 'success'> =
  {
    new: 'info',
    triaged: 'neutral',
    planned: 'accent',
    // Amber as "in motion", not as caution — it is the one stage where something
    // is actively being done, and it needs to be distinct from `new`.
    in_progress: 'warning',
    shipped: 'success',
    declined: 'neutral',
    answered: 'success',
  };

export function FeedbackStatusBadge({ status }: { status: FeedbackStatus }) {
  return (
    <Badge color={STATUS_COLOR[status]} variant="soft" size="sm">
      {FEEDBACK_STATUS_LABELS[status]}
    </Badge>
  );
}

/** The list title: the explicit subject, else the first line of the message. */
export function deriveTitle(submission: Pick<FeedbackSubmission, 'subject' | 'body'>): string {
  if (submission.subject?.trim()) return submission.subject.trim();
  const firstLine = submission.body.split('\n')[0]?.trim() ?? '';
  if (!firstLine) return 'Feedback';
  return firstLine.length > 80 ? `${firstLine.slice(0, 77)}…` : firstLine;
}
