// Wire shapes for /v1/staff/*.
//
// Shared rather than per-file because the person appears on four surfaces and a
// second spelling of "who this is" is how a roster and a timesheet start
// disagreeing about someone's name.
//
// Money is CENTS on the wire, everywhere, and rates ride along ONLY when the
// caller may see pay — the flag is decided once in `lib/staff-context.ts` and
// passed in, never re-derived here.

import { certificationState, type CertificationState } from '@sparx/staff';

export interface StaffCertificationRow {
  id: string;
  staffMemberId: string;
  name: string;
  issuer: string | null;
  referenceNumber: string | null;
  issuedOn: Date | null;
  expiresOn: Date | null;
  reminderLeadDays: number;
  lastRemindedAt: Date | null;
  documentId: string | null;
  notes: string | null;
}

/** Loose enough to take BOTH a raw Prisma row (whose `burdenPercent` is a
 *  Decimal) and the already-converted `PayRate` the service hands back. Every
 *  field is REQUIRED on purpose: `note` was once optional here so that a service
 *  type which had quietly dropped it still satisfied this interface, and the
 *  column rendered an em-dash on every rate anyone had ever annotated. An
 *  optional field in a view type hides exactly that. */
export interface StaffPayRateRow {
  id: string;
  basis: string;
  amountCents: number;
  currency: string;
  burdenPercent: { toString(): string };
  // REQUIRED, not optional — the same lesson `note` taught on this exact type:
  // an optional field lets a mapper that never copies it still satisfy the
  // interface, and the column then renders as nothing on every row.
  commissionPercent: { toString(): string };
  effectiveFrom: Date;
  effectiveTo: Date | null;
  note: string | null;
}

export interface StaffMemberRow {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
  employmentType: string;
  status: string;
  startedOn: Date | null;
  endedOn: Date | null;
  userId: string | null;
  resourceId: string | null;
  externalPayrollId: string | null;
  color: string | null;
  photoUrl: string | null;
  notes: string | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  siteLinks: { propertyId: string; isPrimary: boolean }[];
  payRates: StaffPayRateRow[];
  certifications: StaffCertificationRow[];
  documents: { id: string }[];
}

/** The name as a person would say it. One field, computed once, so a surface
 *  never has to decide what to do about someone who goes by one name. */
export function displayName(row: { firstName: string; lastName: string | null }): string {
  return row.lastName ? `${row.firstName} ${row.lastName}` : row.firstName;
}

export function payRateView(rate: StaffPayRateRow) {
  return {
    id: rate.id,
    basis: rate.basis,
    amountCents: rate.amountCents,
    currency: rate.currency,
    burdenPercent: Number(rate.burdenPercent.toString()),
    commissionPercent: Number(rate.commissionPercent.toString()),
    effectiveFrom: rate.effectiveFrom,
    effectiveTo: rate.effectiveTo,
    note: rate.note,
  };
}

export function certificationView(row: StaffCertificationRow, today: Date) {
  const state = certificationState(
    { expiresOn: row.expiresOn, reminderLeadDays: row.reminderLeadDays },
    today
  );
  return {
    id: row.id,
    staffMemberId: row.staffMemberId,
    name: row.name,
    issuer: row.issuer,
    referenceNumber: row.referenceNumber,
    issuedOn: row.issuedOn,
    expiresOn: row.expiresOn,
    reminderLeadDays: row.reminderLeadDays,
    lastRemindedAt: row.lastRemindedAt,
    documentId: row.documentId,
    notes: row.notes,
    // Resolved server-side so every surface agrees on what "expiring" means —
    // it depends on the certification's OWN lead time, which a client would have
    // to re-implement to get right. `none` is a qualification that does not
    // expire: a real answer, and it must never render as a warning.
    state,
    daysUntilExpiry:
      row.expiresOn === null
        ? null
        : Math.ceil((startOfDay(row.expiresOn) - startOfDay(today)) / 86_400_000),
  };
}

function startOfDay(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/** The roster's at-a-glance warning (docs/149 §5). Counts rather than a single
 *  worst-state so the People list can say "2 expired" instead of a bare red dot
 *  that makes someone open the pane to find out how bad it is. */
function certificationSummary(rows: StaffCertificationRow[], today: Date) {
  let expired = 0;
  let expiring = 0;
  let soonest: Date | null = null;
  for (const row of rows) {
    const state: CertificationState = certificationState(
      { expiresOn: row.expiresOn, reminderLeadDays: row.reminderLeadDays },
      today
    );
    if (state === 'expired') expired += 1;
    if (state === 'expiring') expiring += 1;
    if (row.expiresOn && (soonest === null || row.expiresOn < soonest)) soonest = row.expiresOn;
  }
  return { total: rows.length, expired, expiring, soonestExpiry: soonest };
}

export function memberView(row: StaffMemberRow, today: Date, includePay: boolean) {
  const primary = row.siteLinks.find((link) => link.isPrimary) ?? null;
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    name: displayName(row),
    email: row.email,
    phone: row.phone,
    jobTitle: row.jobTitle,
    employmentType: row.employmentType,
    status: row.status,
    startedOn: row.startedOn,
    endedOn: row.endedOn,
    // The three links out, sent as ids. Whether they resolve to anything depends
    // on modules this tenant may not have bought, so the surface asks the module
    // that owns them rather than this route pretending to know.
    userId: row.userId,
    resourceId: row.resourceId,
    externalPayrollId: row.externalPayrollId,
    color: row.color,
    photoUrl: row.photoUrl,
    notes: row.notes,
    siteIds: row.siteLinks.map((link) => link.propertyId),
    primarySiteId: primary?.propertyId ?? null,
    certifications: row.certifications.map((c) => certificationView(c, today)),
    certificationSummary: certificationSummary(row.certifications, today),
    documentCount: row.documents.length,
    // Absent, not empty, for a caller without pay access — an empty array would
    // read as "this person has no rate on file", which is a different and much
    // more alarming fact than "you may not see it".
    payRates: includePay ? row.payRates.map(payRateView) : undefined,
    archivedAt: row.archivedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
