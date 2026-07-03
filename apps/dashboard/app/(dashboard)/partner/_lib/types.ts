// The Partner Portal's consumed API shapes (docs/114 §B.7/B.8). These mirror the
// api-rest partner routes' responses — which serialize the Prisma rows to JSON, so
// every `DateTime` arrives as an ISO string and the `Decimal` commission rate as a
// numeric string. Kept local to the portal (not imported from services) so the
// dashboard stays decoupled from the backend's internal types; the enums come from
// `@sparx/partner-schemas` (the shared source of truth) so the literals can't drift.

import type {
  BootcampFormat,
  BootcampStatus,
  CommissionStatus,
  CommissionType,
  PartnerKind,
  PartnerStatus,
  PartnerTier,
  PayoutStatus,
  ReferralStatus,
  RegistrationMode,
} from '@sparx/partner-schemas';

/** The partner capability row (`GET /v1/partner/profile`, or `null`). */
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

/** `GET /v1/partner/overview` (or `null` when the tenant isn't a partner). */
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
  /** The referred org's live display name, resolved server-side (docs/114 §B.7).
   *  Null only when the org row can't be resolved — the UI falls back to a short id. */
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

/** A partner's client — the union of referral attribution and consultant access
 *  (docs/114 §B.7). At least one of `referred` / `managed` is always true. Built
 *  in the dashboard by joining the referral ledger (partner-scoped) with the
 *  operator's own consultant memberships (auth-layer, per-user). */
export interface PartnerClient {
  orgId: string;
  name: string;
  /** This org signed up under the partner's referral link. */
  referred: boolean;
  /** The current operator holds consultant access to this org (can enter it). */
  managed: boolean;
  /** Present when referred — the referral's lifecycle. */
  referralStatus: ReferralStatus | null;
  /** Present when referred — when the referred org first paid (drives commission). */
  firstPaymentAt: string | null;
  /** Present when referred — one_time | ongoing (ongoing = managed 5%). */
  commissionType: CommissionType | null;
  /** Present when managed — the org slug, for the "Enter" workspace switch. */
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
