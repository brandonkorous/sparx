// The operator console's pg pool size. It shares the 35-slot sparx server with every app,
// so the Deployment sets it (OPERATOR_DB_POOL_MAX, k8s/azure/apps/db-budget.yaml).

/** Used when OPERATOR_DB_POOL_MAX is unset or not a positive integer. */
export const DEFAULT_OPERATOR_POOL_MAX = 5;

/** The pool's `max`: OPERATOR_DB_POOL_MAX when it is a positive integer, else the default. */
export function operatorPoolMax(raw: string | undefined): number {
  const n = Number(raw?.trim());
  return Number.isInteger(n) && n > 0 ? n : DEFAULT_OPERATOR_POOL_MAX;
}
