// @sparx/staff — the people who do the work (docs/149).
//
// The module exists because wages are the largest single expense in most service
// businesses, so job profitability is arithmetically impossible without knowing
// who worked how long at what rate. Staff is not adjacent to finance; it is the
// SOURCE of the biggest number in the ledger.
//
// NOT PAYROLL, permanently. No withholding, no filing, no benefits, no payments
// to anyone. sparx records hours and rates and hands them over.
//
// Layout, and it is worth keeping:
//
//   pay.ts        pure. Imports NOTHING. Rate windows, burden, hourly and salary
//                 costing, proportional splitting. The arithmetic that goes
//                 quietly wrong, isolated so it can be tested exhaustively.
//   costing.ts    pure. Imports only pay.ts. Approved time → money, per site,
//                 per job, with unpriced hours reported rather than zeroed.
//   everything else touches Postgres.

export * from './errors.js';

export {
  applyBurden,
  dayFromKey,
  dayKey,
  daysInYear,
  hourlyCostCents,
  inclusiveDayCount,
  periodKey,
  rateInForceOn,
  rateSegments,
  salaryCostCents,
  splitProportionally,
  windowsOverlap,
  type PayBasis,
  type PayRate,
  type RateSegment,
} from './pay.js';

export {
  deriveLabor,
  type LaborAllocation,
  type LaborDerivation,
  type LaborEntry,
  type LaborSiteCost,
} from './costing.js';

export {
  archiveMember,
  createMember,
  deleteMember,
  getMember,
  listMembers,
  restoreMember,
  updateMember,
  type EmploymentType,
  type ListMembersQuery,
  type StaffMemberInput,
  type StaffStatus,
} from './members.js';

export { deleteRate, listRates, setRate, toPayRate, type SetRateInput } from './rates.js';

export {
  approveTimeEntries,
  clockedMinutes,
  clockIn,
  clockOut,
  createTimeEntry,
  deleteTimeEntry,
  listTimeEntries,
  openEntries,
  rejectTimeEntries,
  reopenTimeEntries,
  updateTimeEntry,
  type ApprovedTimeEntry,
  type ListTimeQuery,
  type TimeEntryInput,
  type TimeEntrySource,
  type TimeEntryStatus,
} from './time.js';

export {
  monthPeriod,
  periodLabel,
  timesheetPeriod,
  type TimesheetPeriod,
  type TimesheetRow,
} from './timesheets.js';

export {
  cancelTimeOff,
  createShift,
  decideTimeOff,
  deleteShift,
  listShifts,
  listTimeOff,
  publishShifts,
  requestTimeOff,
  updateShift,
  type ShiftInput,
  type ShiftStatus,
  type TimeOffInput,
  type TimeOffKind,
  type TimeOffStatus,
} from './schedule.js';

export {
  certificationState,
  certificationsNeedingReminder,
  createCertification,
  daysUntilExpiry,
  deleteCertification,
  listCertifications,
  markReminded,
  updateCertification,
  type CertificationInput,
  type CertificationState,
} from './certifications.js';

export {
  addDocument,
  deleteDocument,
  listDocuments,
  updateDocument,
  type StaffDocumentInput,
  type StaffDocumentKind,
} from './documents.js';

export {
  attributeSale,
  clearSaleAttribution,
  commissionCents,
  deleteCommission,
  listCommissions,
  recordCommission,
  saleAttribution,
  setCommissionStatus,
  type CommissionInput,
  type CommissionSource,
  type CommissionStatus,
} from './commissions.js';

export {
  commissionForDeal,
  commissionForOrder,
  decimalToCents,
  refundAdjustedBasis,
  type CommissionOutcome,
} from './commission-calc.js';

export { deriveLaborForPeriod, deriveLaborForRoster, type DeriveResult } from './labor.js';

export { buildPayrollExport, type PayrollExport, type PayrollExportRow } from './payroll-export.js';
