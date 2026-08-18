// sparx Finance (docs/148) — service-layer barrel.
//
// The spend ledger, job allocation, recurring costs, and the daily profit rollup.
// Consumed by the REST API, Server Actions, the finance-worker, and (later) the
// MCP tools — every transport validates against `@wizeworks/finance/schemas` first,
// then calls these.
//
// What this module is NOT is as load-bearing as what it is: there is no general
// ledger here, no chart of accounts, no bank reconciliation, no payroll and no
// tax filing. sparx records what a business spent, nets it against what it
// earned, and exports to the system that actually keeps the books. See docs/148
// §1 before adding anything that starts to look like accounting.

export * from './errors';

export {
  SEED_CATEGORIES,
  WAGES_CATEGORY_SLUG,
  SOFTWARE_CATEGORY_SLUG,
  type SeedCategory,
  seedCategories,
  categoryBySlug,
  listCategories,
  createCategory,
  updateCategory,
  archiveCategory,
  deleteCategory,
} from './categories';

export {
  listVendors,
  getVendor,
  createVendor,
  updateVendor,
  archiveVendor,
  vendorSpendCents,
} from './vendors';

export {
  type ExpenseWithDetail,
  type ExpenseListPage,
  assertAllocationsFit,
  unallocatedCents,
  createExpense,
  upsertDerivedExpense,
  getExpense,
  updateExpense,
  setExpensePaid,
  deleteExpense,
  listExpenses,
  expensesForTarget,
} from './expenses';

export {
  type GenerationResult,
  advanceOccurrence,
  anchorDayFor,
  firstOccurrence,
  occurrencesDue,
  periodKey,
  listRecurring,
  createRecurring,
  updateRecurring,
  deleteRecurring,
  generateDueExpenses,
} from './recurring';

export {
  type ProfitInputs,
  type ProfitFigures,
  type RecomputedDay,
  computeProfit,
  utcDayRange,
  utcMidnight,
  recomputeDay,
  recomputeRange,
  profitForRange,
} from './rollup';

export {
  type JobType,
  type RevenueBasis,
  type JobProfit,
  type JobProfitQuery,
  jobMargin,
  sortJobs,
  jobProfitability,
} from './jobs';

export { type FinanceProvisionResult, provisionFinance } from './provisioning';

// The accounting handoff (docs/148 §6) — the whole product position depends on
// this being genuinely good, so it is a first-class part of the module rather
// than an afterthought bolted to an export button.
export { toCsv, parseCsv, parseCsvObjects } from './accounting/csv';
export {
  type ExportRequest,
  type ExportResult,
  accountFor,
  buildExport,
  exportColumns,
} from './accounting/export';
export {
  type ColumnMap,
  type ImportRequest,
  type ImportRow,
  type ImportPreview,
  type ImportResult,
  parseAmountCents,
  parseImportDate,
  previewImport,
  commitImport,
} from './accounting/import';
export {
  type AccountingProviderDescriptor,
  type PublicAccountingConnection,
  type UpsertConnectionInput,
  type MappingInput,
  type RecordRunInput,
  AccountingConnectionNotFoundError,
  AccountingProviderUnavailableError,
  accountingCatalog,
  assertProviderAvailable,
  listConnections,
  // Prefer these two in anything that reaches a browser — `listConnections`
  // returns the row, tokens and all. See the note on `PublicAccountingConnection`.
  listPublicConnections,
  toPublicConnection,
  upsertConnection,
  deleteConnection,
  setMappings,
  listMappings,
  mappingsForExport,
  recordSyncRun,
  listSyncRuns,
  markExported,
} from './accounting/connections';

// The two live adapters (docs/146 Phase 10.7–10.8). Complete code; whether a
// tenant may connect one is a deployment fact reported by `isConfigured()`.
export {
  accountingAdapter,
  accountingAdapters,
  accountingProviderAvailability,
  quickbooksAdapter,
  xeroAdapter,
  AccountingAuthError,
  AccountingRequestError,
  centsToAmount,
  amountToCents,
} from './accounting/providers';

// The grant itself — stored encrypted, refreshed on read, and written back the
// moment a provider rotates it.
export {
  storeCredentials,
  loadCredentials,
  clearCredentials,
  markExpired,
  AccountingCredentialsError,
} from './accounting/credentials';
export type { StoreCredentialsInput } from './accounting/credentials';
export type {
  AccountingAdapter,
  AccountingCredentials,
  RefreshedCredentials,
  ExternalAccount,
  PostJournalRequest,
  PostJournalResult,
} from './accounting/providers';
