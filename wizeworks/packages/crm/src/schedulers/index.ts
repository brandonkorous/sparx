// CRM scheduler barrel. The Cloud Scheduler tick imports each function
// and calls it for every CRM-active tenant. See docs/11 Phase 5 for the
// production wiring.

export {
  runDailyAutomationTriggers,
  type TriggerThresholds,
  type TriggerSummary,
} from './automation-triggers';
export { emitOverdueTaskReminders } from './overdue-task-reminders';
export { ensureCrmActivitiesPartitions, type PartitionRolloverResult } from './partition-rollover';
export { listCrmActiveTenants, listInvoicingActiveTenants } from './active-tenants';
// Invoicing analytics rollup (docs/97) — gated on the `invoicing` module flag.
export { reconcileCollectedRollup, type CollectedRollupResult } from './collected-rollup';
