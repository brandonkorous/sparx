// Scheduler-facing exports for the automation engine. The api-rest
// /internal/automations/* cron route invokes these per tenant — the nightly
// run-activity rollup reconcile (docs/97 §5) and the tenant enumeration it
// iterates.

export { listAutomationActiveTenants } from './active-tenants';
export { reconcileRunsRollup, type RunsRollupResult } from './runs-rollup';
