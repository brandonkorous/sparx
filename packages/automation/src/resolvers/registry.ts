// Entity-resolver registry (docs/81 §5.3).
//
// Trigger payloads are THIN IDs (`{ customerId }`, `{ orderId }`), not rich
// records — so before conditions can reference `customer.type` or `order.total`
// the engine must HYDRATE the referenced entity from the DB (under the tenant
// tx, RLS-scoped). A trigger resolver maps an event type → a flat, dotted-path
// field map. Conditions + the AI assistant only ever see fields a resolver
// actually exposes.
//
// Two registries:
//   • trigger resolvers — keyed by event type, for event-driven automations.
//   • schedule scanners — keyed by entity, for scheduled (predicate) triggers:
//     "customer inactive 45 days" has no per-record event, only a scan.

import type { ResolvedFields, TenantCtx } from '../engine-types';

/** Hydrate the entities referenced by an event into flat resolved fields. */
export type TriggerResolver = (
  ctx: TenantCtx,
  payload: Record<string, unknown>
) => Promise<ResolvedFields>;

/**
 * A scanned row for a scheduled (predicate) trigger: its id (used to synthesize
 * the per-row run + dedupe key) plus the resolved fields the predicate + the
 * automation's own conditions evaluate against.
 */
export interface ScannedRow {
  id: string;
  fields: ResolvedFields;
}

/** Scan an entity type for a scheduled trigger — returns one row per candidate. */
export type ScheduleScanner = (ctx: TenantCtx) => Promise<ScannedRow[]>;

const triggerResolvers = new Map<string, TriggerResolver>();
const scheduleScanners = new Map<string, ScheduleScanner>();

export function registerResolver(eventType: string, resolver: TriggerResolver): void {
  triggerResolvers.set(eventType, resolver);
}

export function registerScanner(entity: string, scanner: ScheduleScanner): void {
  scheduleScanners.set(entity, scanner);
}

/**
 * Resolve the fields for an event. Three paths:
 *   • a carried `__fields` snapshot wins (scheduled runs scan the entity up front
 *     and stamp the resolved fields onto the synthesized envelope — there is no
 *     per-row event to re-resolve from);
 *   • otherwise the registered resolver for the event type hydrates the entity;
 *   • an unregistered event yields an empty map — an automation with no
 *     conditions still runs, one with field conditions simply won't match (the
 *     safe default: we never fabricate fields).
 */
export async function resolveFields(
  ctx: TenantCtx,
  eventType: string,
  payload: Record<string, unknown>
): Promise<ResolvedFields> {
  const snapshot = payload.__fields;
  if (snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)) {
    return snapshot as ResolvedFields;
  }
  const resolver = triggerResolvers.get(eventType);
  if (!resolver) return {};
  return resolver(ctx, payload);
}

export function getScanner(entity: string): ScheduleScanner | undefined {
  return scheduleScanners.get(entity);
}

/** Test/introspection hook — the set of event types with a registered resolver. */
export function registeredResolverEvents(): string[] {
  return [...triggerResolvers.keys()];
}

export function registeredScannerEntities(): string[] {
  return [...scheduleScanners.keys()];
}
