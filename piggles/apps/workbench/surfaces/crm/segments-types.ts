'use client';

// What a segment IS, and the query keys every read nests under. The base of the
// segment data layer: reads, writes and hand-picked lists all import this, and
// none of them import each other's internals.

import type { Customer } from './customers-data';

export interface Segment {
  id: string;
  propertyId: string | null;
  name: string;
  slug: string;
  description: string | null;
  /**
   * How membership is decided (docs/144 §10).
   *
   * `dynamic` — the rules decide, and the evaluator keeps it current.
   * `static` — a hand-picked set; the evaluator leaves it alone entirely.
   */
  kind: 'dynamic' | 'static';
  /** The predicate tree. Read for the list's one-line summary (segment-summary.ts),
   *  never edited here. */
  rules: unknown;
  color: string | null;
  isSystem: boolean;
  isBuiltIn: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** How many customers are in it right now. Present on LIST rows only — the
   *  detail pane counts live against the rules being edited, which is a
   *  different (and more expensive) question. */
  _count?: { members: number };
}

/** One materialised membership, with the customer it points at. */
export interface SegmentMember {
  customerId: string;
  enteredAt: string;
  customer: Customer;
}

export interface SegmentListParams {
  q?: string;
  includeArchived?: boolean;
}

export const segmentKeys = {
  all: ['crm', 'segments'] as const,
  list: (params: SegmentListParams) => [...segmentKeys.all, 'list', params] as const,
  detail: (id: string) => [...segmentKeys.all, id] as const,
  members: (id: string) => [...segmentKeys.all, id, 'members'] as const,
  count: (id: string) => [...segmentKeys.all, id, 'member-count'] as const,
  history: (id: string) => [...segmentKeys.all, id, 'history'] as const,
};

export function segmentMembership(count: number): string {
  if (count === 0) return 'No members yet';
  if (count === 1) return '1 customer';
  return `${count.toLocaleString()} customers`;
}
