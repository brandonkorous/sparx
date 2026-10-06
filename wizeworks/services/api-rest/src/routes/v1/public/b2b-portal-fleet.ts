// B2B customer portal: the trade account's fleet (sparx persona issue 086).
//
//   GET    /v1/public/b2b/portal/:accountId/fleet?tenant=
//          → { vehicles, canEdit }: every vehicle with its id and its words
//   POST   /v1/public/b2b/portal/:accountId/fleet/vehicles?tenant=
//          → add one vehicle (the account's primary contact only)
//   PUT    /v1/public/b2b/portal/:accountId/fleet/vehicles/:vehicleId?tenant=
//          → change one vehicle; its id, and the service history linked to it, stay
//   DELETE /v1/public/b2b/portal/:accountId/fleet/vehicles/:vehicleId?tenant=
//          → take one vehicle off the fleet
//
// Guarded like the rest of the portal (b2b-portal.ts): a signed-in customer for
// this site with an ACTIVE contact role on the account in the path. Any role may
// read the fleet, since the catalog already tells every buyer on the account which
// parts fit it. Only the primary contact may change it: the fleet decides what the
// whole account is shown as fitting, which is the account holder's call.
//
// A connected app (a customer MCP bearer) may read but never change the fleet:
// the customer scopes have no B2B write scope, and a fleet edit is not one to
// grant through `b2b:read`.
//
// The guards are repeated here rather than imported because b2b-portal.ts keeps
// them module-private, the same as b2b-portal-statement.ts.

import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { withTenant } from '@wizeworks/db';
import { fleetService } from '@wizeworks/b2b';
import { vehicleLabel } from '@wizeworks/commerce-schemas';
import { ok } from '@wizeworks/api-core/envelope';
import { forbidden } from '@wizeworks/api-core/errors';
import type { CustomerAuthContext } from '@wizeworks/customer-auth';
import { resolveTenantId } from '../../../lib/public-commerce-context.js';
import { requireCustomer } from '../../../lib/customer-session.js';

const PathAccountId = z.object({ accountId: z.string().uuid() });
const PathVehicle = z.object({ accountId: z.string().uuid(), vehicleId: z.string().uuid() });

/** The role that may change the fleet. */
export const FLEET_EDITOR_ROLE = 'primary_contact';

/** 403 unless the customer has an active role on THIS account; returns the role. */
async function requireContactRole(
  ctx: CustomerAuthContext,
  customerId: string,
  accountId: string
): Promise<string> {
  const contact = await withTenant(ctx, (tx) =>
    tx.b2bAccountContact.findFirst({
      where: { customerId, accountId, isActive: true },
      select: { role: true },
    })
  );
  if (!contact) throw forbidden('You do not have access to this B2B account.');
  return contact.role;
}

/** The signed-in contact and their role on the account in the path. */
async function guarded(request: FastifyRequest) {
  const tenantId = await resolveTenantId(request);
  const ctx: CustomerAuthContext = { tenantId };
  const customer = await requireCustomer(request, ctx, 'b2b:read');
  const { accountId } = PathAccountId.parse(request.params);
  const role = await requireContactRole(ctx, customer.customerId, accountId);
  // A first-party session has no scopes; a connected app always has some.
  const isSession = customer.scopes === null;
  return { ctx, accountId, role, canEdit: isSession && role === FLEET_EDITOR_ROLE };
}

/** As `guarded`, refusing anyone who may not change the fleet. */
async function guardedEditor(request: FastifyRequest) {
  const g = await guarded(request);
  if (!g.canEdit) {
    throw forbidden(
      g.role === FLEET_EDITOR_ROLE
        ? 'A connected app can read your fleet but cannot change it. Sign in on the website to make changes.'
        : 'Only the main contact on this account can change its vehicles.'
    );
  }
  return g;
}

function worded<T extends Parameters<typeof vehicleLabel>[0]>(v: T) {
  return { ...v, displayName: vehicleLabel(v) };
}

const b2bPortalFleetRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/public/b2b/portal/:accountId/fleet', async (request) => {
    const { ctx, accountId, canEdit } = await guarded(request);
    const vehicles = await fleetService.getAccountFleet(ctx, accountId);
    return ok({ vehicles: vehicles.map(worded), canEdit });
  });

  app.post('/v1/public/b2b/portal/:accountId/fleet/vehicles', async (request, reply) => {
    const { ctx, accountId } = await guardedEditor(request);
    const result = await fleetService.addFleetVehicle(ctx, accountId, request.body);
    return reply.code(201).send(ok({ vehicle: worded(result.vehicle) }));
  });

  app.put('/v1/public/b2b/portal/:accountId/fleet/vehicles/:vehicleId', async (request) => {
    const { ctx, accountId } = await guardedEditor(request);
    const { vehicleId } = PathVehicle.parse(request.params);
    const result = await fleetService.updateFleetVehicle(ctx, accountId, vehicleId, request.body);
    return ok({ vehicle: worded(result.vehicle) });
  });

  app.delete('/v1/public/b2b/portal/:accountId/fleet/vehicles/:vehicleId', async (request) => {
    const { ctx, accountId } = await guardedEditor(request);
    const { vehicleId } = PathVehicle.parse(request.params);
    await fleetService.removeFleetVehicle(ctx, accountId, vehicleId);
    return ok({ removed: vehicleId });
  });

  return Promise.resolve();
};

export default b2bPortalFleetRoutes;
