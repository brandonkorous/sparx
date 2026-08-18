'use client';

// Staff (docs/149) — the data layer for the people who do the work.
//
// Money is CENTS on the wire, everywhere, and `costCents` is NULLABLE on
// purpose: null means nobody has recorded what this person earns, which is a
// different fact from zero and must never render as one. Every type here keeps
// that distinction, and `format.ts` is what turns null into "—" plus a prompt.
//
// PAY IS NOT ALWAYS THERE. `payRates` is absent — not empty — for a caller
// without admin, and the timesheet grid 403s for them entirely. `pay.forbidden`
// below is how a surface tells "you may not see this" apart from "there is
// nothing to see".

import { useMutation, useQuery, useQueryClient } from '@wizeworks/query';
import { ApiError } from '@wizeworks/api-client';
import { api } from '../../lib/api/client';
import { getTokenState, resolveToken } from '../../lib/api/token';

/* ── Shapes ────────────────────────────────────────────────────────────────── */

export type EmploymentType = 'employee' | 'contractor' | 'volunteer';
export type StaffStatus = 'active' | 'onboarding' | 'suspended' | 'former';
export type PayBasis = 'hourly' | 'salary' | 'commission' | 'none';
export type TimeEntryStatus = 'open' | 'submitted' | 'approved' | 'rejected';
export type ShiftStatus = 'draft' | 'published' | 'cancelled';
export type TimeOffKind = 'vacation' | 'sick' | 'unpaid' | 'other';
export type TimeOffStatus = 'requested' | 'approved' | 'denied' | 'cancelled';
export type CertificationState = 'expired' | 'expiring' | 'valid' | 'none';
export type CommissionStatus = 'pending' | 'approved' | 'paid' | 'void';

export interface PayRate {
  id: string;
  basis: PayBasis;
  /** Cents. Per HOUR under `hourly`, per YEAR under `salary`. */
  amountCents: number;
  currency: string;
  burdenPercent: number;
  /** The share of a SALE, under `commission` only and zero otherwise. A separate
   *  field because `amountCents` is per-hour or per-YEAR — there was no unit left
   *  that could mean "7.5% of what they sell". */
  commissionPercent: number;
  effectiveFrom: string;
  /** Null = the rate in force today. */
  effectiveTo: string | null;
  note: string | null;
}

export interface Certification {
  id: string;
  staffMemberId: string;
  name: string;
  issuer: string | null;
  referenceNumber: string | null;
  issuedOn: string | null;
  /** Null is a REAL answer — a qualification that does not expire. */
  expiresOn: string | null;
  reminderLeadDays: number;
  lastRemindedAt: string | null;
  documentId: string | null;
  notes: string | null;
  /** Resolved server-side against this certification's own lead time. */
  state: CertificationState;
  daysUntilExpiry: number | null;
}

export interface CertificationRow extends Certification {
  staffMemberName: string;
  staffMemberStatus: string;
}

export interface StaffMember {
  id: string;
  firstName: string;
  lastName: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
  employmentType: EmploymentType;
  status: StaffStatus;
  startedOn: string | null;
  endedOn: string | null;
  userId: string | null;
  resourceId: string | null;
  externalPayrollId: string | null;
  color: string | null;
  photoUrl: string | null;
  notes: string | null;
  siteIds: string[];
  primarySiteId: string | null;
  certifications: Certification[];
  certificationSummary: {
    total: number;
    expired: number;
    expiring: number;
    soonestExpiry: string | null;
  };
  documentCount: number;
  /** ABSENT, not empty, for a caller without pay access. */
  payRates?: PayRate[];
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StaffDocument {
  id: string;
  staffMemberId: string;
  assetId: string;
  kind: 'contract' | 'handbook' | 'id' | 'certification' | 'other';
  title: string;
  signedAt: string | null;
  expiresOn: string | null;
  createdAt: string;
}

export interface TimeEntry {
  id: string;
  staffMemberId: string;
  staffMemberName: string | null;
  propertyId: string | null;
  workedOn: string;
  startedAt: string | null;
  endedAt: string | null;
  minutes: number;
  breakMinutes: number;
  jobType: 'order' | 'booking' | null;
  jobId: string | null;
  source: 'clock' | 'manual' | 'import';
  status: TimeEntryStatus;
  approvedAt: string | null;
  approvedBy: string | null;
  note: string | null;
  /** False once approved — the profit figure was built on it. */
  editable: boolean;
}

export interface TimesheetRow {
  staffMemberId: string;
  name: string;
  status: string;
  totalMinutes: number;
  submittedMinutes: number;
  approvedMinutes: number;
  openEntries: number;
  /** NULL IS NOT ZERO — see the header. */
  costCents: number | null;
  unpricedMinutes: number;
  unpricedDays: string[];
  bases: PayBasis[];
}

export interface TimesheetPeriod {
  from: string;
  to: string;
  label: string;
  rows: TimesheetRow[];
  costCents: number;
  approvedMinutes: number;
  pendingMinutes: number;
  rowsNeedingRates: number;
  /** False when at least one row could not be costed, so the total is partial. */
  complete: boolean;
}

export interface Shift {
  id: string;
  staffMemberId: string;
  staffMemberName: string | null;
  color: string | null;
  propertyId: string | null;
  startsAt: string;
  endsAt: string;
  label: string | null;
  status: ShiftStatus;
  notes: string | null;
}

export interface TimeOffRequest {
  id: string;
  staffMemberId: string;
  staffMemberName: string | null;
  kind: TimeOffKind;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  reason: string | null;
  status: TimeOffStatus;
  decidedAt: string | null;
  decidedBy: string | null;
  decisionNote: string | null;
  /** True only when approval actually blocked them in the booking engine. */
  blocksBookings: boolean;
}

export interface Commission {
  id: string;
  staffMemberId: string;
  staffMemberName: string | null;
  sourceType: 'order' | 'deal';
  sourceId: string;
  sourceLabel: string | null;
  basisCents: number;
  ratePercent: number | null;
  amountCents: number;
  currency: string;
  earnedOn: string;
  status: CommissionStatus;
  paidAt: string | null;
  note: string | null;
}

/* ── Cache ─────────────────────────────────────────────────────────────────── */

// ONE root for the whole module. Approving time changes the roster's open-clock
// count, the timesheet total AND the wage expense behind the profit figure —
// three views of one act, and letting them disagree for a render is how a total
// looks broken.
const STAFF_KEY = ['staff'] as const;

function useInvalidateStaff() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: STAFF_KEY });
}

/* ── Reads ─────────────────────────────────────────────────────────────────── */

export interface MemberFilters {
  status?: StaffStatus;
  search?: string;
  includeArchived?: boolean;
  property?: string;
}

export function useStaffMembers(filters: MemberFilters = {}) {
  return useQuery({
    queryKey: [...STAFF_KEY, 'members', filters],
    queryFn: () =>
      api.get<{ items: StaffMember[] }>('/v1/staff/members', {
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.search ? { search: filters.search } : {}),
        ...(filters.includeArchived ? { includeArchived: 'true' } : {}),
        ...(filters.property ? { property: filters.property } : {}),
      }),
    placeholderData: (previous) => previous,
  });
}

export function useStaffMember(id: string) {
  return useQuery({
    queryKey: [...STAFF_KEY, 'member', id],
    queryFn: () => api.get<StaffMember>(`/v1/staff/members/${encodeURIComponent(id)}`),
    enabled: id !== 'new',
  });
}

/** The rate history. 403s for anyone below admin, and the pane reads
 *  `isForbidden(error)` rather than showing an empty list. */
export function usePayRates(staffMemberId: string, enabled: boolean) {
  return useQuery({
    queryKey: [...STAFF_KEY, 'rates', staffMemberId],
    queryFn: () =>
      api.get<{ items: PayRate[] }>(`/v1/staff/members/${encodeURIComponent(staffMemberId)}/rates`),
    enabled: enabled && staffMemberId !== 'new',
    retry: false,
  });
}

export function useStaffDocuments(staffMemberId: string, enabled: boolean) {
  return useQuery({
    queryKey: [...STAFF_KEY, 'documents', staffMemberId],
    queryFn: () =>
      api.get<{ items: StaffDocument[] }>(
        `/v1/staff/members/${encodeURIComponent(staffMemberId)}/documents`
      ),
    enabled: enabled && staffMemberId !== 'new',
    retry: false,
  });
}

export interface TimeFilters {
  staffMemberId?: string;
  from?: string;
  to?: string;
  status?: TimeEntryStatus;
  jobType?: 'order' | 'booking';
  jobId?: string;
}

export function useTimeEntries(filters: TimeFilters, enabled = true) {
  return useQuery({
    queryKey: [...STAFF_KEY, 'time', filters],
    queryFn: () =>
      api.get<{ items: TimeEntry[]; totalMinutes: number }>('/v1/staff/time', {
        ...(filters.staffMemberId ? { staffMemberId: filters.staffMemberId } : {}),
        ...(filters.from ? { from: filters.from } : {}),
        ...(filters.to ? { to: filters.to } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.jobType ? { jobType: filters.jobType } : {}),
        ...(filters.jobId ? { jobId: filters.jobId } : {}),
      }),
    enabled,
    placeholderData: (previous) => previous,
  });
}

/** Who is on the clock right now. Polled, because it is the one figure on the
 *  roster that changes without anybody on this screen doing anything. */
export function useOpenClocks() {
  return useQuery({
    queryKey: [...STAFF_KEY, 'time', 'open'],
    queryFn: () => api.get<{ items: TimeEntry[] }>('/v1/staff/time/open'),
    refetchInterval: 60_000,
  });
}

export function useTimesheet(period: { from: string; to: string; property?: string }) {
  return useQuery({
    queryKey: [...STAFF_KEY, 'timesheet', period],
    queryFn: () =>
      api.get<TimesheetPeriod>('/v1/staff/timesheets', {
        from: period.from,
        to: period.to,
        ...(period.property ? { property: period.property } : {}),
      }),
    placeholderData: (previous) => previous,
    retry: false,
  });
}

export function useShifts(range: { from: string; to: string; staffMemberId?: string }) {
  return useQuery({
    queryKey: [...STAFF_KEY, 'shifts', range],
    queryFn: () =>
      api.get<{ items: Shift[] }>('/v1/staff/shifts', {
        from: range.from,
        to: range.to,
        ...(range.staffMemberId ? { staffMemberId: range.staffMemberId } : {}),
      }),
    placeholderData: (previous) => previous,
  });
}

export function useTimeOff(query: { status?: TimeOffStatus; staffMemberId?: string } = {}) {
  return useQuery({
    queryKey: [...STAFF_KEY, 'time-off', query],
    queryFn: () =>
      api.get<{ items: TimeOffRequest[]; requestedCount: number }>('/v1/staff/time-off', {
        ...(query.status ? { status: query.status } : {}),
        ...(query.staffMemberId ? { staffMemberId: query.staffMemberId } : {}),
      }),
    placeholderData: (previous) => previous,
  });
}

export function useCertifications(query: { staffMemberId?: string; expiringWithinDays?: number }) {
  return useQuery({
    queryKey: [...STAFF_KEY, 'certifications', query],
    queryFn: () =>
      api.get<{ items: CertificationRow[]; expiredCount: number; expiringCount: number }>(
        '/v1/staff/certifications',
        {
          ...(query.staffMemberId ? { staffMemberId: query.staffMemberId } : {}),
          ...(query.expiringWithinDays !== undefined
            ? { expiringWithinDays: String(query.expiringWithinDays) }
            : {}),
        }
      ),
    placeholderData: (previous) => previous,
  });
}

export function useCommissions(query: { staffMemberId?: string }, enabled: boolean) {
  return useQuery({
    queryKey: [...STAFF_KEY, 'commissions', query],
    queryFn: () =>
      api.get<{ items: Commission[]; totalCents: number }>('/v1/staff/commissions', {
        ...(query.staffMemberId ? { staffMemberId: query.staffMemberId } : {}),
      }),
    enabled,
    retry: false,
  });
}

/* ── Writes ────────────────────────────────────────────────────────────────── */

export interface MemberDraft {
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
  employmentType: EmploymentType;
  status: StaffStatus;
  startedOn: string | null;
  endedOn: string | null;
  externalPayrollId: string | null;
  notes: string | null;
  siteIds: string[];
  primarySiteId: string | null;
}

export function useSaveMember(id: string) {
  const invalidate = useInvalidateStaff();
  return useMutation({
    mutationFn: (draft: MemberDraft) =>
      id === 'new'
        ? api.post<StaffMember>('/v1/staff/members', draft)
        : api.patch<StaffMember>(`/v1/staff/members/${encodeURIComponent(id)}`, draft),
    onSuccess: invalidate,
  });
}

/** Archive is the ordinary "they left" — their hours are in last year's profit
 *  figure, and deleting the person would leave that number with no subject. */
export function useArchiveMember() {
  const invalidate = useInvalidateStaff();
  return useMutation({
    mutationFn: (input: { id: string; archived: boolean }) =>
      api.post<StaffMember>(
        `/v1/staff/members/${encodeURIComponent(input.id)}/${input.archived ? 'archive' : 'restore'}`,
        {}
      ),
    onSuccess: invalidate,
  });
}

export function useDeleteMember() {
  const invalidate = useInvalidateStaff();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/v1/staff/members/${encodeURIComponent(id)}`),
    onSuccess: invalidate,
  });
}

export interface RateDraft {
  basis: PayBasis;
  amountCents: number;
  burdenPercent: number;
  commissionPercent: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  note: string | null;
}

export function useSetRate(staffMemberId: string) {
  const invalidate = useInvalidateStaff();
  return useMutation({
    mutationFn: (draft: RateDraft) =>
      api.post<PayRate>(`/v1/staff/members/${encodeURIComponent(staffMemberId)}/rates`, draft),
    onSuccess: invalidate,
  });
}

export function useDeleteRate() {
  const invalidate = useInvalidateStaff();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/v1/staff/rates/${encodeURIComponent(id)}`),
    onSuccess: invalidate,
  });
}

export interface TimeEntryDraft {
  staffMemberId: string;
  workedOn: string;
  minutes: number;
  breakMinutes?: number;
  propertyId?: string | null;
  jobType?: 'order' | 'booking' | null;
  jobId?: string | null;
  note?: string | null;
}

export function useCreateTimeEntry() {
  const invalidate = useInvalidateStaff();
  return useMutation({
    mutationFn: (draft: TimeEntryDraft) => api.post<TimeEntry>('/v1/staff/time', draft),
    onSuccess: invalidate,
  });
}

export function useUpdateTimeEntry() {
  const invalidate = useInvalidateStaff();
  return useMutation({
    mutationFn: (input: { id: string } & Partial<TimeEntryDraft>) => {
      const { id, ...rest } = input;
      return api.patch<TimeEntry>(`/v1/staff/time/${encodeURIComponent(id)}`, rest);
    },
    onSuccess: invalidate,
  });
}

export function useDeleteTimeEntry() {
  const invalidate = useInvalidateStaff();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/v1/staff/time/${encodeURIComponent(id)}`),
    onSuccess: invalidate,
  });
}

export function useClock() {
  const invalidate = useInvalidateStaff();
  const clockIn = useMutation({
    mutationFn: (input: { staffMemberId: string; propertyId?: string | null }) =>
      api.post<TimeEntry>('/v1/staff/time/clock-in', input),
    onSuccess: invalidate,
  });
  const clockOut = useMutation({
    mutationFn: (input: { staffMemberId: string; breakMinutes?: number }) =>
      api.post<TimeEntry>('/v1/staff/time/clock-out', input),
    onSuccess: invalidate,
  });
  return { clockIn, clockOut };
}

export interface ApprovalResult {
  approvedIds: string[];
  staffMemberIds: string[];
  /** Entries still on the clock. They have no duration yet, so approving one
   *  would bank a zero — the surface says which people to chase. */
  skippedOpen: string[];
}

export function useTimeDecision() {
  const invalidate = useInvalidateStaff();
  const approve = useMutation({
    mutationFn: (ids: string[]) => api.post<ApprovalResult>('/v1/staff/time/approve', { ids }),
    onSuccess: invalidate,
  });
  const reject = useMutation({
    mutationFn: (ids: string[]) => api.post<{ ids: string[] }>('/v1/staff/time/reject', { ids }),
    onSuccess: invalidate,
  });
  const reopen = useMutation({
    mutationFn: (ids: string[]) => api.post<{ ids: string[] }>('/v1/staff/time/reopen', { ids }),
    onSuccess: invalidate,
  });
  return { approve, reject, reopen };
}

/** Re-file a period's wages into finance by hand. Not the normal path —
 *  approval already publishes the event — but the async one can be behind. */
export function useDeriveLabor() {
  const invalidate = useInvalidateStaff();
  return useMutation({
    mutationFn: (input: { from: string; to: string; staffMemberId?: string }) =>
      api.post<{
        people: number;
        expenses: number;
        totalCents: number;
        unpricedMinutes: number;
        unpricedDays: string[];
      }>('/v1/staff/timesheets/derive', input),
    onSuccess: invalidate,
  });
}

export interface ShiftDraft {
  staffMemberId: string;
  startsAt: string;
  endsAt: string;
  propertyId?: string | null;
  label?: string | null;
  status?: ShiftStatus;
  notes?: string | null;
}

export function useSaveShift() {
  const invalidate = useInvalidateStaff();
  return useMutation({
    mutationFn: (input: { id: string | null } & ShiftDraft) => {
      const { id, ...draft } = input;
      return id
        ? api.patch<Shift>(`/v1/staff/shifts/${encodeURIComponent(id)}`, draft)
        : api.post<Shift>('/v1/staff/shifts', draft);
    },
    onSuccess: invalidate,
  });
}

export function useDeleteShift() {
  const invalidate = useInvalidateStaff();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/v1/staff/shifts/${encodeURIComponent(id)}`),
    onSuccess: invalidate,
  });
}

export function usePublishShifts() {
  const invalidate = useInvalidateStaff();
  return useMutation({
    mutationFn: (ids: string[]) =>
      api.post<{ published: number }>('/v1/staff/shifts/publish', { ids }),
    onSuccess: invalidate,
  });
}

export function useRequestTimeOff() {
  const invalidate = useInvalidateStaff();
  return useMutation({
    mutationFn: (draft: {
      staffMemberId: string;
      kind: TimeOffKind;
      startsAt: string;
      endsAt: string;
      reason: string | null;
    }) => api.post<TimeOffRequest>('/v1/staff/time-off', draft),
    onSuccess: invalidate,
  });
}

export function useDecideTimeOff() {
  const invalidate = useInvalidateStaff();
  const decide = useMutation({
    mutationFn: (input: { id: string; status: 'approved' | 'denied'; note?: string | null }) =>
      api.post<TimeOffRequest>(`/v1/staff/time-off/${encodeURIComponent(input.id)}/decision`, {
        status: input.status,
        note: input.note ?? null,
      }),
    onSuccess: invalidate,
  });
  const cancel = useMutation({
    mutationFn: (id: string) =>
      api.post<TimeOffRequest>(`/v1/staff/time-off/${encodeURIComponent(id)}/cancel`, {}),
    onSuccess: invalidate,
  });
  return { decide, cancel };
}

export interface CertificationDraft {
  staffMemberId: string;
  name: string;
  issuer: string | null;
  referenceNumber: string | null;
  issuedOn: string | null;
  expiresOn: string | null;
  reminderLeadDays: number;
  notes: string | null;
}

export function useSaveCertification() {
  const invalidate = useInvalidateStaff();
  return useMutation({
    mutationFn: (input: { id: string | null } & CertificationDraft) => {
      const { id, staffMemberId, ...rest } = input;
      return id
        ? api.patch<Certification>(`/v1/staff/certifications/${encodeURIComponent(id)}`, rest)
        : api.post<Certification>('/v1/staff/certifications', { staffMemberId, ...rest });
    },
    onSuccess: invalidate,
  });
}

export function useDeleteCertification() {
  const invalidate = useInvalidateStaff();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/v1/staff/certifications/${encodeURIComponent(id)}`),
    onSuccess: invalidate,
  });
}

/* ── The payroll handoff ───────────────────────────────────────────────────── */

/**
 * Download the period's hours file.
 *
 * A raw `fetch` rather than the api client, because the response is a FILE and
 * the client parses JSON. Both the base URL and the bearer token are resolved at
 * click time so a pane left open overnight cannot download with a dead one.
 *
 * Returns the unpriced-minutes count. It arrives in a header because a download
 * cannot carry a warning, and dropping it would hand somebody a file whose hours
 * column and cost column disagree with no explanation of why.
 */
export async function downloadPayrollHours(params: {
  from: string;
  to: string;
}): Promise<{ filename: string; unpricedMinutes: number }> {
  const state = await getTokenState();
  const token = await resolveToken();
  const query = new URLSearchParams({ from: params.from, to: params.to });

  const response = await fetch(`${state.apiUrl}/v1/staff/timesheets/export?${query.toString()}`, {
    headers: {
      authorization: `Bearer ${token}`,
      ...(state.propertyId ? { 'x-sparx-property-id': state.propertyId } : {}),
    },
  });

  if (!response.ok) {
    // The error path DOES answer JSON — the file body only exists on success.
    // Rebuilt as a real ApiError so `staffErrorMessage` shows the server's own
    // sentence exactly as it would for any other 4xx.
    const detail = (await response.json().catch(() => null)) as {
      error?: { message?: string; code?: string; request_id?: string };
    } | null;
    throw new ApiError(response.status, {
      success: false,
      error: {
        message: detail?.error?.message ?? 'The hours file could not be built.',
        code: detail?.error?.code ?? 'EXPORT_FAILED',
        request_id: detail?.error?.request_id ?? '',
      },
    });
  }

  const disposition = response.headers.get('content-disposition') ?? '';
  const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? 'hours.csv';
  const unpriced = Number(response.headers.get('x-sparx-unpriced-minutes') ?? '0');

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  // Revoking immediately races the download in Safari.
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);

  return { filename, unpricedMinutes: Number.isFinite(unpriced) ? unpriced : 0 };
}

/* ── Errors ────────────────────────────────────────────────────────────────── */

/** The server's own sentence for a 4xx, verbatim — @wizeworks/staff writes those
 *  messages for a business owner ("End the existing rate first, or pick a start
 *  date after it"), and nothing this side could infer beats them. */
export function staffErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return error.message;
  }
  return fallback;
}

export function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

/** "You may not see this" — distinct from "there is nothing to see". Pay lives
 *  behind an admin gate, so a manager opening a colleague's pane gets a sentence
 *  explaining the absence rather than an empty rate history that reads as
 *  "nobody has ever recorded what this person earns". */
export function isForbidden(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403;
}

/* ── Who sold it (docs/149 §10) ────────────────────────────────────────────── */

export interface SaleAttribution {
  id: string;
  staffMemberId: string;
  staffMemberName: string | null;
  propertyId: string | null;
  note: string | null;
}

/** What a recalculation did. `outcome` is the honest reason a sale earned
 *  nothing, and the two ordinary reasons — nobody credited, or the person is not
 *  on commission — are fixed in completely different places, so the screen has
 *  to be able to tell them apart. */
export interface CommissionOutcome {
  outcome:
    | 'recorded'
    | 'no-attribution'
    | 'no-rate'
    | 'rate-not-in-force'
    | 'not-payable'
    | 'unknown-sale';
  staffMemberId?: string;
  basisCents?: number;
  ratePercent?: number;
  amountCents?: number;
  /** `rate-not-in-force` only — the day their commission starts, and the day the
   *  sale earned on. ISO days, rendered in UTC (see `formatDay`). */
  rateStartsOn?: string;
  earnedOn?: string;
}

export type SaleType = 'order' | 'deal';

/**
 * Who is credited for a sale, or `null` when nobody is.
 *
 * `enabled` gates on the staff module AND on pay access: every
 * `/v1/staff/sales/*` route is admin-only, so a viewer asking would get a 403
 * they can do nothing about. The order pane passes `false` rather than showing
 * an error where a section should be.
 */
export function useSaleAttribution(type: SaleType, id: string, enabled: boolean) {
  return useQuery({
    queryKey: [...STAFF_KEY, 'attribution', type, id],
    queryFn: () => api.get<SaleAttribution | null>(`/v1/staff/sales/${type}/${id}/attribution`),
    enabled,
    retry: false,
  });
}

export function useAttributeSale(type: SaleType, id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: { staffMemberId: string; note?: string | null }) =>
      api.put<{ attribution: SaleAttribution; commission: CommissionOutcome }>(
        `/v1/staff/sales/${type}/${id}/attribution`,
        body
      ),
    onSuccess: () => {
      // The commission list moves too — crediting a sale recalculates it on the
      // spot, so a stale figure beside a fresh attribution would be the screen
      // contradicting itself.
      void client.invalidateQueries({ queryKey: STAFF_KEY });
    },
  });
}

export function useClearSaleAttribution(type: SaleType, id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete<void>(`/v1/staff/sales/${type}/${id}/attribution`),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: STAFF_KEY });
    },
  });
}
