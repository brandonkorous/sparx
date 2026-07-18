// CRM Server Actions — barrel.
//
// Each domain has its own `'use server'` module (customer-actions,
// deal-actions, order-actions, etc.). This barrel re-exports them so
// existing imports keep working while each file stays under the 200-line
// target. The CRM module gate (locked decision #6) is now enforced by
// api-rest (`requireCrmModule` per route); each action is a thin POST/
// PATCH against /v1/crm/* via `_rest-action.ts`.

export type { ActionResult } from './_action-helpers';

export * from './customer-actions';
export * from './deal-actions';
export * from './activity-task-actions';
// Order actions are NOT re-exported here. Orders left the CRM module — they
// are a shared spine rendered by Commerce, B2B, and CRM alike, and now live in
// _orders/actions/. Importing them through a CRM barrel would recreate exactly
// the coupling that move removed.
export * from './pipeline-actions';
export * from './b2b-actions';
export * from './segment-actions';
