'use client';

// Partner programme data — the one place the whole module's types, query keys,
// mutations and display helpers live.
//
// The partner surfaces are ORG-scoped, not site-scoped: the partner capability is
// a tenant-level relationship (the referral ledger, the tier, the directory
// listing are the same whichever site the operator is working in), so nothing
// here passes `?property=` — the JWT `tid` is the whole of the scope. Every route
// is gated server-side to the PARTNER_OPS capability set {owner, admin, partner}.
//
// Money always arrives from the API as integer CENTS (`amountCents`,
// `lifetimeCents`, `payoutMinCents`). It is formatted to a currency string at the
// display edge with `formatCents` and never divided by hand at a call site.

import { useMutation, useQuery, useQueryClient } from '@wizeworks/query';
import { ApiError } from '@wizeworks/api-client';
import { apiErrorMessage } from '../../lib/api-error';
import { api } from '../../lib/api/client';

/* ── Enums (mirror @wizeworks/partner-schemas, kept local so a pane never imports the
      backend graph — the literals can't drift because the server validates) ──── */

export type PartnerTier = 'informal' | 'registered' | 'certified';
export type PartnerStatus = 'pending' | 'active' | 'suspended';
export type PartnerKind = 'freelance' | 'agency' | 'developer' | 'other';
export type ReferralStatus = 'pending' | 'active' | 'churned' | 'forfeited';
export type CommissionType = 'one_time' | 'ongoing';
export type CommissionStatus = 'pending' | 'approved' | 'paid' | 'forfeited';
export type PayoutStatus = 'pending' | 'processing' | 'paid' | 'failed';
export type BootcampFormat = 'in_person' | 'virtual' | 'hybrid' | 'async';
export type BootcampStatus = 'draft' | 'published' | 'cancelled' | 'completed';
export type RegistrationMode = 'internal' | 'external';

/* ── Response shapes ──────────────────────────────────────────────────────── */

/** The partner capability row (`GET /v1/partner/profile`, or `null` when the org
 *  is not a partner at all). */
export interface PartnerProfile {
  id: string;
  tenantId: string;
  tier: PartnerTier;
  status: PartnerStatus;
  displayName: string;
  bio: string | null;
  websiteUrl: string | null;
  kind: PartnerKind;
  locationCity: string | null;
  locationState: string | null;
  locationCountry: string | null;
  isRemote: boolean;
  specialties: string[];
  photoUrl: string | null;
  directoryVisible: boolean;
  referralCode: string;
  stripePayoutAccountId: string | null;
  payoutMinCents: number;
  appliedAt: string | null;
  approvedAt: string | null;
  certifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

/** `GET /v1/partner/overview` (or `null` when the org isn't a partner). */
export interface PartnerOverview {
  partner: PartnerProfile;
  referralCount: number;
  activeReferrals: number;
  lifetimeCents: number;
  pendingCents: number;
}

/** One row in the referral ledger (`GET /v1/partner/referrals`). */
export interface PartnerReferral {
  id: string;
  referredTenantId: string;
  /** The referred org's live display name, resolved server-side. Null only when
   *  the org row can't be resolved — the UI falls back to a short id. */
  referredOrgName: string | null;
  referralCode: string;
  signupAt: string;
  firstPaymentAt: string | null;
  /** Prisma Decimal → JSON string, e.g. "0.2000". */
  commissionRate: string;
  commissionType: CommissionType;
  status: ReferralStatus;
  createdAt: string;
}

export interface ReferralsResponse {
  referralCode: string;
  referrals: PartnerReferral[];
}

/** A client — the union of referral attribution and consultant access
 *  (`GET /v1/partner/clients`). At least one of `referred` / `managed` is true. */
export interface PartnerClient {
  orgId: string;
  name: string;
  referred: boolean;
  managed: boolean;
  referralStatus: ReferralStatus | null;
  firstPaymentAt: string | null;
  commissionType: CommissionType | null;
  slug: string | null;
}

/** One accrued commission (`GET /v1/partner/commissions`). */
export interface PartnerCommission {
  id: string;
  referralId: string | null;
  amountCents: number;
  currency: string;
  period: string | null;
  kind: CommissionType;
  status: CommissionStatus;
  payoutRunId: string | null;
  stripeTransferId: string | null;
  paidAt: string | null;
  createdAt: string;
}

/** One monthly payout run (`GET /v1/partner/payouts`). */
export interface PartnerPayoutRun {
  id: string;
  periodStart: string;
  periodEnd: string;
  amountCents: number;
  currency: string;
  commissionCount: number;
  status: PayoutStatus;
  stripeTransferId: string | null;
  failureReason: string | null;
  paidAt: string | null;
  createdAt: string;
}

/** A partner-hosted bootcamp (`GET /v1/partner/bootcamps[/:id]`). */
export interface Bootcamp {
  id: string;
  partnerId: string;
  title: string;
  slug: string;
  description: string;
  format: BootcampFormat;
  locationCity: string | null;
  locationState: string | null;
  locationCountry: string;
  startsAt: string;
  endsAt: string;
  seatsTotal: number | null;
  seatsFilled: number;
  priceCents: number;
  currency: string;
  registrationMode: RegistrationMode;
  registrationUrl: string | null;
  status: BootcampStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

/* ── Query keys ───────────────────────────────────────────────────────────── */

export const PARTNER_KEYS = {
  profile: ['partner', 'profile'] as const,
  overview: ['partner', 'overview'] as const,
  referrals: ['partner', 'referrals'] as const,
  clients: ['partner', 'clients'] as const,
  commissions: ['partner', 'commissions'] as const,
  payouts: ['partner', 'payouts'] as const,
  bootcamps: ['partner', 'bootcamps'] as const,
  bootcamp: (id: string) => ['partner', 'bootcamp', id] as const,
};

/* ── Reads ────────────────────────────────────────────────────────────────── */

/** The org's own partner listing — or `null` if it isn't a partner. Read by
 *  several surfaces (they all need to know tier/status), so it carries a longer
 *  stale time and one shared key. */
export function usePartnerProfile() {
  return useQuery({
    queryKey: PARTNER_KEYS.profile,
    queryFn: () => api.get<PartnerProfile | null>('/v1/partner/profile'),
    staleTime: 60_000,
  });
}

export function usePartnerOverview() {
  return useQuery({
    queryKey: PARTNER_KEYS.overview,
    queryFn: () => api.get<PartnerOverview | null>('/v1/partner/overview'),
  });
}

export function useReferrals() {
  return useQuery({
    queryKey: PARTNER_KEYS.referrals,
    queryFn: () => api.get<ReferralsResponse>('/v1/partner/referrals'),
  });
}

export function usePartnerClients() {
  return useQuery({
    queryKey: PARTNER_KEYS.clients,
    queryFn: () => api.get<PartnerClient[]>('/v1/partner/clients'),
  });
}

export function useCommissions() {
  return useQuery({
    queryKey: PARTNER_KEYS.commissions,
    queryFn: () => api.get<PartnerCommission[]>('/v1/partner/commissions'),
  });
}

export function usePayouts() {
  return useQuery({
    queryKey: PARTNER_KEYS.payouts,
    queryFn: () => api.get<PartnerPayoutRun[]>('/v1/partner/payouts'),
  });
}

export function useBootcamps() {
  return useQuery({
    queryKey: PARTNER_KEYS.bootcamps,
    queryFn: () => api.get<Bootcamp[]>('/v1/partner/bootcamps'),
  });
}

export function useBootcamp(id: string) {
  return useQuery({
    queryKey: PARTNER_KEYS.bootcamp(id),
    queryFn: () => api.get<Bootcamp>(`/v1/partner/bootcamps/${id}`),
    enabled: id !== 'new',
  });
}

/* ── Writes ───────────────────────────────────────────────────────────────── */

/** The fields the directory listing edit accepts (`PUT /v1/partner/profile`). All
 *  optional — an omitted field is left as it was, never clobbered to a default. */
export interface ProfileInput {
  displayName?: string;
  bio?: string | null;
  websiteUrl?: string | null;
  kind?: PartnerKind;
  locationCity?: string | null;
  locationState?: string | null;
  locationCountry?: string | null;
  isRemote?: boolean;
  specialties?: string[];
  photoUrl?: string | null;
  directoryVisible?: boolean;
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ProfileInput) => api.put<PartnerProfile>('/v1/partner/profile', input),
    onSuccess: (partner) => {
      queryClient.setQueryData(PARTNER_KEYS.profile, partner);
      void queryClient.invalidateQueries({ queryKey: PARTNER_KEYS.overview });
    },
  });
}

export function useApplyTier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { requestedTier: PartnerTier; note?: string }) =>
      api.post<{ ok: boolean; status: string }>('/v1/partner/tier/apply', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PARTNER_KEYS.overview });
      void queryClient.invalidateQueries({ queryKey: PARTNER_KEYS.profile });
    },
  });
}

/** Begin Stripe Connect payout onboarding. Returns a hosted Account Link URL the
 *  pane redirects the whole window to. */
export function useConnectPayouts() {
  return useMutation({
    mutationFn: (input: { returnUrl: string; refreshUrl: string }) =>
      api.post<{ url: string; accountId: string }>('/v1/partner/payouts/connect', input),
  });
}

/** Fields the bootcamp create/update accept. Dates are ISO instants. */
export interface BootcampInput {
  title: string;
  description: string;
  format: BootcampFormat;
  locationCity?: string | null;
  locationState?: string | null;
  locationCountry: string;
  startsAt: string;
  endsAt: string;
  seatsTotal?: number | null;
  priceCents: number;
  currency: string;
  registrationMode: RegistrationMode;
  registrationUrl?: string | null;
}

function useInvalidateBootcamps() {
  const queryClient = useQueryClient();
  return (id?: string) => {
    void queryClient.invalidateQueries({ queryKey: PARTNER_KEYS.bootcamps });
    if (id) void queryClient.invalidateQueries({ queryKey: PARTNER_KEYS.bootcamp(id) });
  };
}

export function useCreateBootcamp() {
  const invalidate = useInvalidateBootcamps();
  return useMutation({
    mutationFn: (input: BootcampInput) => api.post<Bootcamp>('/v1/partner/bootcamps', input),
    onSuccess: (bootcamp) => {
      invalidate(bootcamp.id);
    },
  });
}

export function useUpdateBootcamp(id: string) {
  const invalidate = useInvalidateBootcamps();
  return useMutation({
    mutationFn: (input: Partial<BootcampInput>) =>
      api.put<Bootcamp>(`/v1/partner/bootcamps/${id}`, input),
    onSuccess: () => {
      invalidate(id);
    },
  });
}

export function useSetBootcampStatus(id: string) {
  const invalidate = useInvalidateBootcamps();
  return useMutation({
    mutationFn: (status: BootcampStatus) =>
      api.patch<Bootcamp>(`/v1/partner/bootcamps/${id}/status`, { status }),
    onSuccess: () => {
      invalidate(id);
    },
  });
}

export function useDeleteBootcamp(id: string) {
  const invalidate = useInvalidateBootcamps();
  return useMutation({
    mutationFn: () => api.delete(`/v1/partner/bootcamps/${id}`),
    onSuccess: () => {
      invalidate();
    },
  });
}

/* ── Errors ───────────────────────────────────────────────────────────────── */

/** The server's own sentence for a 4xx is worth showing verbatim — these routes
 *  say exactly what went wrong ("Publishing bootcamps requires the Certified
 *  partner tier.", "Only draft bootcamps can be deleted."). A 5xx has no such
 *  sentence, so it falls back to the caller's wording. */
export function partnerErrorMessage(error: unknown, fallback: string): string {
  return apiErrorMessage(error, fallback);
}

export function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}
