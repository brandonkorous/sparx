// B2B customer portal: the buyer's own account statement.
//
//   GET /v1/public/b2b/portal/:accountId/statement?tenant=&from=&to=
//       → the statement for a period: opening, every invoice and payment with
//         their PO numbers, closing, and how late
//   GET /v1/public/b2b/portal/:accountId/statement/print?tenant=&from=&to=
//       → the same, as a branded page to print or save as a PDF
//
// Guarded exactly like the rest of the portal (b2b-portal.ts): a signed-in
// customer for this site, with an ACTIVE contact role on the account they are
// asking about. Any role may read it: a viewer can see the account's invoices,
// and a statement is those invoices added up.
//
// The two guards are repeated here rather than imported because b2b-portal.ts
// keeps them module-private. They are four lines each and read the same tables.

import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { withTenant } from '@wizeworks/db';
import { b2bStatementService, renderAccountStatementHtml } from '@wizeworks/crm';
import { ok } from '@wizeworks/api-core/envelope';
import { forbidden } from '@wizeworks/api-core/errors';
import { type CustomerAuthContext } from '@wizeworks/customer-auth';
import { resolveTenantId } from '../../../lib/public-commerce-context.js';
import { requireCustomerId } from '../../../lib/customer-session.js';
import { resolveInvoiceBrand } from '../../../lib/invoice-render.js';

const PathAccountId = z.object({ accountId: z.string().uuid() });
const Period = z.object({
  from: z.string().trim().max(10).nullish(),
  to: z.string().trim().max(10).nullish(),
});

/** The signed-in customer for this site, or 401. Read-only, so an MCP bearer
 *  needs `b2b:read`, the same scope as the rest of the portal. */
function requirePortalCustomer(request: FastifyRequest, ctx: CustomerAuthContext): Promise<string> {
  return requireCustomerId(request, ctx, 'b2b:read');
}

/** 403 unless the customer has an active role on THIS account. */
async function requireContactRole(
  ctx: CustomerAuthContext,
  customerId: string,
  accountId: string
): Promise<void> {
  const contact = await withTenant(ctx, (tx) =>
    tx.b2bAccountContact.findFirst({
      where: { customerId, accountId, isActive: true },
      select: { role: true },
    })
  );
  if (!contact) throw forbidden('You do not have access to this B2B account.');
}

async function guardedStatement(request: FastifyRequest) {
  const tenantId = await resolveTenantId(request);
  const ctx: CustomerAuthContext = { tenantId };
  const customerId = await requirePortalCustomer(request, ctx);
  const { accountId } = PathAccountId.parse(request.params);
  await requireContactRole(ctx, customerId, accountId);
  const period = Period.parse(request.query);
  const statement = await b2bStatementService.buildAccountStatement(ctx, {
    accountId,
    ...period,
  });
  return { ctx, statement };
}

const b2bPortalStatementRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/public/b2b/portal/:accountId/statement', async (request) => {
    const { statement } = await guardedStatement(request);
    return ok(statement);
  });

  // A page the buyer prints from their own browser. Reached through the site's
  // same-origin proxy, so the session cookie travels with it and the page's
  // print button prints it.
  app.get('/v1/public/b2b/portal/:accountId/statement/print', async (request, reply) => {
    const { ctx, statement } = await guardedStatement(request);
    const brand = await resolveInvoiceBrand(ctx);
    const html = renderAccountStatementHtml(statement, brand, { printButton: true });
    void reply.header('Content-Type', 'text/html; charset=utf-8');
    void reply.header('Cache-Control', 'private, no-store');
    return reply.send(html);
  });

  return Promise.resolve();
};

export default b2bPortalStatementRoutes;
