'use client';

// One entry per field a segment rule can ask about — the words, the grouping and
// the value kind. Data only; the accessor and the custom-property handling live
// in ./segment-fields.

import type { SegmentField } from '@wizeworks/crm-schemas';
import {
  LEAD_STATUSES,
  LIFECYCLE_STAGES,
  RELATIONSHIP_TYPES,
  customerTypeMeta,
  leadStatusMeta,
  lifecycleStageMeta,
} from './customers-data';
import { PAYMENT_TERM_PRESETS } from '../../lib/payment-terms';
import type { FieldMeta } from './segment-fields';

export const FIELD_META: Record<SegmentField, FieldMeta> = {
  'customer.type': {
    label: 'Relationship',
    group: 'Customer',
    kind: 'enum',
    options: RELATIONSHIP_TYPES.map((t) => ({ value: t, label: customerTypeMeta(t).label })),
  },
  'customer.lifecycleStage': {
    label: 'Lifecycle stage',
    group: 'Customer',
    kind: 'enum',
    options: LIFECYCLE_STAGES.map((s) => ({ value: s, label: lifecycleStageMeta(s).label })),
  },
  'customer.leadStatus': {
    label: 'Lead status',
    group: 'Customer',
    kind: 'enum',
    options: LEAD_STATUSES.map((s) => ({ value: s, label: leadStatusMeta(s).label })),
  },
  'customer.email': { label: 'Email', group: 'Customer', kind: 'text' },
  'customer.tags': {
    label: 'Label',
    group: 'Customer',
    kind: 'tags',
    hint: 'Matches one of the labels on the customer.',
  },
  'customer.company': { label: 'Company', group: 'Customer', kind: 'text' },
  'customer.createdAt': { label: 'Date added', group: 'Customer', kind: 'date' },
  'customer.daysSinceCreated': {
    label: 'Days since they were added',
    group: 'Customer',
    kind: 'number',
    hint: 'E.g. at most 30 for “people who joined this month”.',
  },
  'customer.totalSpent': {
    label: 'Total spent',
    group: 'Customer',
    kind: 'number',
    hint: 'A whole amount, e.g. 500.',
  },
  'customer.orderCount': { label: 'Number of orders', group: 'Customer', kind: 'number' },
  'customer.firstOrderAt': { label: 'First order date', group: 'Customer', kind: 'date' },
  'customer.lastOrderAt': { label: 'Last order date', group: 'Customer', kind: 'date' },
  'customer.daysSinceLastOrder': {
    label: 'Days since last order',
    group: 'Customer',
    kind: 'number',
    hint: 'E.g. more than 365 for “not bought in a year”.',
  },
  'customer.assignedRepId': { label: 'Looked after by', group: 'Customer', kind: 'rep' },
  'customer.doNotContact': { label: 'Do not send marketing', group: 'Customer', kind: 'boolean' },
  'customer.b2bAccountId': {
    label: 'Linked wholesale account',
    group: 'Customer',
    kind: 'account',
  },
  'b2bAccount.pricingTier': { label: 'Price tier', group: 'Wholesale account', kind: 'text' },
  'b2bAccount.creditUtilization': {
    label: 'Credit used (share)',
    group: 'Wholesale account',
    kind: 'number',
    hint: 'A share between 0 and 1 — 0.8 means 80% of their limit is used.',
  },
  'b2bAccount.fleetSize': { label: 'Fleet size', group: 'Wholesale account', kind: 'number' },
  'b2bAccount.status': {
    label: 'Account status',
    group: 'Wholesale account',
    kind: 'enum',
    options: [
      { value: 'active', label: 'Active' },
      { value: 'credit_hold', label: 'Credit hold' },
      { value: 'suspended', label: 'Suspended' },
      { value: 'inactive', label: 'Inactive' },
    ],
  },
  'b2bAccount.paymentTerms': {
    label: 'Payment terms',
    group: 'Wholesale account',
    kind: 'enum',
    // Same presets the company form offers, from the one place they live. A
    // segment that could only be built on four of the terms a business can
    // actually agree would quietly exclude every customer on any other.
    options: PAYMENT_TERM_PRESETS,
  },
  'email.openedLast30d': { label: 'Emails opened (30 days)', group: 'Email', kind: 'number' },
  'email.clickedLast30d': { label: 'Emails clicked (30 days)', group: 'Email', kind: 'number' },
  'email.unsubscribed': { label: 'Has unsubscribed', group: 'Email', kind: 'boolean' },
  'email.subscribed': { label: 'Subscribed to marketing', group: 'Email', kind: 'boolean' },
};
