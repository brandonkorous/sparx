// What the service form holds while it is being edited, and how that becomes a
// service. Pure: no hooks, no JSX. Split out of service-detail.tsx (RULE #0.5).

import { moneyCents } from '../../components/money-input';
import type {
  AssignmentStrategy,
  BookingType,
  ResourceRequirement,
  SchedulingService,
} from './setup-data';

/** The currencies offered, lowercase to match the 3-char ISO the service stores. */
export const CURRENCIES = ['usd', 'cad', 'eur', 'gbp', 'aud', 'nzd', 'jpy'] as const;

export interface Draft {
  name: string;
  description: string;
  bookingType: BookingType;
  durationMinutes: number;
  bufferBeforeMin: number;
  bufferAfterMin: number;
  slotIntervalMin: number;
  price: string;
  currency: string;
  capacity: number;
  policyId: string;
  assignmentStrategy: AssignmentStrategy;
  requirements: ResourceRequirement[];
  minLeadMinutes: number;
  maxAdvanceDays: number;
  bookableOnline: boolean;
  requiresApproval: boolean;
  requiresAsset: boolean;
  isActive: boolean;
}

export const BLANK: Draft = {
  name: '',
  description: '',
  bookingType: 'appointment',
  durationMinutes: 60,
  bufferBeforeMin: 0,
  bufferAfterMin: 0,
  slotIntervalMin: 15,
  price: '',
  currency: 'usd',
  capacity: 1,
  policyId: '',
  assignmentStrategy: 'any_available',
  requirements: [],
  minLeadMinutes: 0,
  maxAdvanceDays: 365,
  bookableOnline: true,
  requiresApproval: false,
  requiresAsset: false,
  isActive: true,
};

function centsToPrice(cents: number): string {
  return cents > 0 ? (cents / 100).toFixed(2) : '';
}

/** A typed price → integer cents, or null when it cannot be read. Blank is
 *  free; "65,00" is sixty-five dollars, not six thousand five hundred, and
 *  anything genuinely unreadable is refused rather than saved as free (086). */
export function priceToCents(value: string): number | null {
  return moneyCents(value);
}

export function draftFrom(service: SchedulingService): Draft {
  return {
    name: service.name,
    description: service.description ?? '',
    bookingType: service.bookingType,
    durationMinutes: service.durationMinutes,
    bufferBeforeMin: service.bufferBeforeMin,
    bufferAfterMin: service.bufferAfterMin,
    slotIntervalMin: service.slotIntervalMin,
    price: centsToPrice(service.priceCents),
    currency: service.currency,
    capacity: service.capacity,
    policyId: service.policyId ?? '',
    assignmentStrategy: service.assignmentStrategy,
    // Field by field, NOT a spread. `draftsEqual` compares stringified drafts,
    // which is key-ORDER sensitive, and the server returns these keys in a
    // different order from the one the form builds them in — so a spread left
    // the pane permanently "not saved" after a save that worked (issue 087).
    requirements: service.resourceRequirements.map((requirement) => ({
      role: requirement.role,
      kind: requirement.kind,
      skillTags: [...requirement.skillTags],
      count: requirement.count,
    })),
    minLeadMinutes: service.minLeadMinutes,
    maxAdvanceDays: service.maxAdvanceDays,
    bookableOnline: service.bookableOnline,
    requiresApproval: service.requiresApproval,
    requiresAsset: service.requiresAsset,
    isActive: service.isActive,
  };
}

/** A whole-object comparison — the requirements are an array, so a field-by-field
 *  check would miss a reorder or a tag edit. */
export function draftsEqual(a: Draft, b: Draft): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** A non-negative integer from a number input, falling back when it is cleared. */
export function intOr(value: number, fallback: number): number {
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;
}

/** The full object every write sends — the create route fills defaults and the
 *  edit route replaces the whole service, so sending it whole keeps the two
 *  paths identical rather than diffing. Requirements with no role name cannot be
 *  matched, so they are dropped rather than left for the server to reject. */
export function payloadFrom(draft: Draft) {
  return {
    name: draft.name.trim(),
    description: draft.description.trim() === '' ? null : draft.description.trim(),
    bookingType: draft.bookingType,
    durationMinutes: draft.durationMinutes,
    bufferBeforeMin: draft.bufferBeforeMin,
    bufferAfterMin: draft.bufferAfterMin,
    slotIntervalMin: Math.max(1, draft.slotIntervalMin),
    // The caller already refused an unreadable price, so the null branch is a
    // belt-and-braces zero rather than a decision.
    priceCents: priceToCents(draft.price) ?? 0,
    currency: draft.currency,
    capacity: draft.bookingType === 'class' ? Math.max(1, draft.capacity) : 1,
    policyId: draft.policyId === '' ? null : draft.policyId,
    assignmentStrategy: draft.assignmentStrategy,
    resourceRequirements: draft.requirements
      .map((requirement) => ({
        role: requirement.role.trim(),
        kind: requirement.kind,
        skillTags: requirement.skillTags.map((tag) => tag.trim()).filter(Boolean),
        count: Math.max(1, requirement.count),
      }))
      .filter((requirement) => requirement.role !== ''),
    minLeadMinutes: draft.minLeadMinutes,
    maxAdvanceDays: draft.maxAdvanceDays,
    bookableOnline: draft.bookableOnline,
    requiresApproval: draft.requiresApproval,
    requiresAsset: draft.requiresAsset,
    isActive: draft.isActive,
  };
}
