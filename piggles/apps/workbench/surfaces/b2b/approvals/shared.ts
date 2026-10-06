import { type QueueItem } from '../approvals-data';

/** Registry module for this pane, so the brand draws Trade's own picture rather
 *  than the generic one. */
export const MODULE = 'b2b';

export type Decision = { item: QueueItem; action: 'approve' | 'reject' } | null;
