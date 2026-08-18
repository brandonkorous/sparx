// Scheduling-domain silica composites (docs/122). Like `commerce.ts`, these are the
// sparx composites silica's shipped block library doesn't cover — here, the default
// bodies for the scheduling module's functional routes. Each wraps a PINNED functional
// core (`host-nodes.ts`) in an editable shell, so a tenant restyles and surrounds the
// booking experience but never deletes the transaction.
//
// AUTHORING CONTRACT (builder-contract §5): every factory returns a FRESH, id-free
// `Node`; every class is a LITERAL string (the seed `stampTree`s these before use).

import type { Node } from '@wizeworks/silicaui-html';

import { HOST_KEYS, functionalShell } from './host-nodes';

/** The full bookable-service DETAIL page body — the `scheduling.service` record
 *  template's default: an editable shell wrapping the PINNED `scheduling.service-detail`
 *  core (the service's header + its LIVE time-picker). Self-contained — the core resolves
 *  the service from the id the route passes via context — so there is no shell heading;
 *  the core renders the service name + duration/price + the booking widget. The route
 *  mounts `<BookingServiceDetail>` at the host node with the service id. */
export function serviceDetailPage(): Node {
  return functionalShell(HOST_KEYS.schedulingServiceDetail);
}
