'use client';

import { Heart, HelpCircle, Lightbulb, TriangleAlert } from 'lucide-react';
import type { FeedbackCategory, FeedbackSubmission } from '../../_shell/feedback-types';

// Shared presentation helpers for the feedback UI — kept in one place so the
// compose form, history list, and thread agree on icons/titles/timestamps.

export const CATEGORY_ICON: Record<
  FeedbackCategory,
  React.ComponentType<{ className?: string }>
> = {
  idea: Lightbulb,
  problem: TriangleAlert,
  question: HelpCircle,
  praise: Heart,
};

// Each category wears its own semantic hue (a ColorKey on the four-axis Button/
// Badge system) so the type picker reads at a glance — idea=primary, problem=
// warning (matches the alert-triangle icon), question=info, praise=success.
export const CATEGORY_COLOR: Record<FeedbackCategory, string> = {
  idea: 'primary',
  problem: 'warning',
  question: 'info',
  praise: 'success',
};

export function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

/** The list title: explicit subject, else the first line of the body. */
export function deriveTitle(sub: Pick<FeedbackSubmission, 'subject' | 'body'>): string {
  if (sub.subject?.trim()) return sub.subject.trim();
  const firstLine = sub.body.split('\n')[0]?.trim() ?? '';
  return firstLine.length > 80 ? `${firstLine.slice(0, 77)}…` : firstLine || 'Feedback';
}
