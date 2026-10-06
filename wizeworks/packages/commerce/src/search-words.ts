// The second line under a search result, in words a business owner reads.
//
// Universal search shows each hit's `subtitle` exactly as it was indexed. Several
// projectors indexed a stored code there: a segment showed "email-engaged", a
// return "account_credit", a task "high", a picture "image/jpeg" (issue 914).
// Those are the database's words, not hers.
//
// Brand-neutral on purpose: this package sits under both consoles, so nothing
// here may use one brand's vocabulary.

/** "credit_hold" → "Credit hold". The fallback for a value no map knows yet,
 *  so a new code reads as words rather than as itself. */
export function codeAsWords(code: string): string {
  const spaced = code.replace(/[-_]+/g, ' ').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function from(map: Record<string, string>, code: string): string {
  return map[code] ?? codeAsWords(code);
}

const SEGMENT_KINDS: Record<string, string> = {
  dynamic: 'Fills itself from rules',
  static: 'Picked by hand',
};

export function segmentKindWords(kind: string): string {
  return from(SEGMENT_KINDS, kind);
}

const COLLECTION_KINDS: Record<string, string> = {
  manual: 'Picked by hand',
  rules: 'Fills itself from rules',
};

/** The same two words a segment uses, because it is the same choice. */
export function collectionKindWords(type: string): string {
  return from(COLLECTION_KINDS, type);
}

const PIPELINE_OBJECTS: Record<string, string> = {
  deal: 'For deals',
  ticket: 'For support requests',
};

export function pipelineObjectWords(objectKey: string): string {
  return PIPELINE_OBJECTS[objectKey] ?? `For ${codeAsWords(objectKey).toLowerCase()}`;
}

const BUNDLE_PRICING: Record<string, string> = {
  sum_of_components: 'Priced as its parts added up',
  fixed: 'One set price',
  percent_off_sum: 'A percentage off its parts',
};

export function bundlePricingWords(mode: string): string {
  return from(BUNDLE_PRICING, mode);
}

const RETURN_OUTCOMES: Record<string, string> = {
  refund: 'Wants a refund',
  account_credit: 'Wants credit on their account',
  exchange: 'Wants an exchange',
  repair: 'Wants it repaired',
};

export function returnOutcomeWords(outcome: string): string {
  return from(RETURN_OUTCOMES, outcome);
}

const COMPANY_STATUSES: Record<string, string> = {
  active: 'Active',
  credit_hold: 'On credit hold',
  suspended: 'Suspended',
  inactive: 'Inactive',
};

export function companyStatusWords(status: string): string {
  return from(COMPANY_STATUSES, status);
}

const PAYMENT_STATUSES: Record<string, string> = {
  unpaid: 'Not paid yet',
  partial: 'Partly paid',
  paid: 'Paid',
  overdue: 'Overdue',
  void: 'Canceled',
};

export function paymentStatusWords(status: string): string {
  return from(PAYMENT_STATUSES, status);
}

const TASK_PRIORITIES: Record<string, string> = {
  low: 'Low priority',
  medium: 'Medium priority',
  high: 'High priority',
  urgent: 'Urgent',
};

export function taskPriorityWords(priority: string): string {
  return from(TASK_PRIORITIES, priority);
}

/**
 * The line under a task in search: how urgent it is while it is open, and that
 * it is closed once it is. Priority alone told nobody a task was finished:
 * "Order O-000012 ... is waiting for your sign-off" sat in the search box as
 * "Medium priority" after the order was signed off and the task was done.
 * The words are the task list's own: Done, Canceled.
 */
export function taskLineWords(status: string, priority: string): string {
  if (status === 'completed') return 'Done';
  if (status === 'cancelled') return 'Canceled';
  return taskPriorityWords(priority);
}

const ENTRY_STATUSES: Record<string, string> = {
  draft: 'Draft',
  published: 'Published',
  scheduled: 'Scheduled',
  archived: 'Archived',
};

export function entryStatusWords(status: string): string {
  return from(ENTRY_STATUSES, status);
}

/** "image/jpeg" → "Image". What kind of file it is, not its format code. */
export function fileKindWords(mimeType: string): string {
  const type = mimeType.toLowerCase();
  if (type.startsWith('image/')) return 'Image';
  if (type.startsWith('video/')) return 'Video';
  if (type.startsWith('audio/')) return 'Sound';
  if (type === 'application/pdf') return 'PDF';
  return 'File';
}
