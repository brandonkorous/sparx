// Feedback-triage presentation helpers (Slice 7). The feedback status lifecycle
// (new → triaged → planned → in_progress → shipped, + declined / answered) has its
// own reading the platform `statusTone` dictionary doesn't fully cover, so — per
// the Badge convention — feedback keeps a curated map.

type Tone = 'success' | 'warning' | 'info' | 'danger' | 'neutral';

const STATUS_TONE: Record<string, Tone> = {
  new: 'info',
  triaged: 'neutral',
  planned: 'warning',
  in_progress: 'info',
  shipped: 'success',
  declined: 'danger',
  answered: 'success',
};

const STATUS_LABEL: Record<string, string> = {
  new: 'New',
  triaged: 'Triaged',
  planned: 'Planned',
  in_progress: 'In progress',
  shipped: 'Shipped',
  declined: 'Declined',
  answered: 'Answered',
};

export const FEEDBACK_STATUSES = [
  'new',
  'triaged',
  'planned',
  'in_progress',
  'shipped',
  'declined',
  'answered',
] as const;

export const FEEDBACK_CATEGORIES = ['idea', 'problem', 'question', 'praise'] as const;

export function feedbackStatusTone(status: string): Tone {
  return STATUS_TONE[status] ?? 'neutral';
}

export function feedbackStatusLabel(status: string): string {
  return STATUS_LABEL[status] ?? status;
}

const CATEGORY_LABEL: Record<string, string> = {
  idea: 'Idea',
  problem: 'Problem',
  question: 'Question',
  praise: 'Praise',
};

export function categoryLabel(category: string): string {
  return CATEGORY_LABEL[category] ?? category;
}

/** Status changes to these notify the submitter automatically. planned/in_progress
 *  notify only when staff opt in; triaged/new never do. Drives the composer hint. */
export function statusAlwaysNotifies(status: string): boolean {
  return status === 'shipped' || status === 'declined' || status === 'answered';
}

const SENTIMENT_LABEL: Record<number, string> = {
  1: 'Very unhappy',
  2: 'Unhappy',
  3: 'Happy',
  4: 'Very happy',
};

export function sentimentLabel(sentiment: number): string {
  return SENTIMENT_LABEL[sentiment] ?? `Sentiment ${sentiment}`;
}

export function sentimentTone(sentiment: number): Tone {
  if (sentiment <= 1) return 'danger';
  if (sentiment === 2) return 'warning';
  return 'success';
}

/** First non-empty (trimmed) value among the candidates, else `''`. Used for the
 *  "subject, else first line, else category" and "name, else email" fallbacks —
 *  where an empty string must fall through (so `??` alone won't do). */
export function firstText(...vals: (string | null | undefined)[]): string {
  for (const v of vals) if (v && v.trim().length > 0) return v;
  return '';
}
