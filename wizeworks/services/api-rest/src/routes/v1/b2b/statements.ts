// B2B account statements: what a trade account owed at the start of a period,
// every invoice, payment and write-off in it with the buyer's PO numbers, what
// it owes at the end, and how late. Thin transport over @wizeworks/crm's
// b2bStatementService; the email goes out through lib/statement-mail.ts.
//
//   GET  /v1/b2b/accounts/:id/statement?from=&to=        → the statement, plus
//                                                         who an email would reach
//   GET  /v1/b2b/accounts/:id/statement/print?from=&to=  → branded print-HTML
//   POST /v1/b2b/accounts/:id/statement/send             → email it { from?, to? }
//
// `from` / `to` are calendar days (`YYYY-MM-DD`). Left out, the period is the
// first of this month to today, on the business's own calendar.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { b2bStatementService, renderAccountStatementHtml } from '@wizeworks/crm';
import { ok } from '@wizeworks/api-core/envelope';
import { requireRole } from '@wizeworks/api-core/auth';
import { requireB2bModule, toB2bContext } from '../../../lib/b2b-context.js';
import { resolveInvoiceBrand } from '../../../lib/invoice-render.js';
import { sendAccountStatement } from '../../../lib/statement-mail.js';

const PathId = z.object({ id: z.string().uuid() });

/** A period. Blank strings count as "not chosen", which is what an empty date
 *  box sends. */
const Period = z.object({
  from: z.string().trim().max(10).nullish(),
  to: z.string().trim().max(10).nullish(),
});

const b2bStatementRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/b2b/accounts/:id/statement', async (request) => {
    requireRole(request, 'viewer');
    await requireB2bModule(request);
    const ctx = toB2bContext(request);
    const { id } = PathId.parse(request.params);
    const period = Period.parse(request.query);
    const [statement, recipients] = await Promise.all([
      b2bStatementService.buildAccountStatement(ctx, { accountId: id, ...period }),
      b2bStatementService.statementRecipients(ctx, id),
    ]);
    return ok({ ...statement, recipients });
  });

  // The page the shop prints, or saves as a PDF, on the same letterhead as its
  // invoices: the brand and the business identity the invoice print resolves.
  app.get('/v1/b2b/accounts/:id/statement/print', async (request, reply) => {
    requireRole(request, 'viewer');
    await requireB2bModule(request);
    const ctx = toB2bContext(request);
    const { id } = PathId.parse(request.params);
    const period = Period.parse(request.query);
    const [statement, brand] = await Promise.all([
      b2bStatementService.buildAccountStatement(ctx, { accountId: id, ...period }),
      resolveInvoiceBrand(ctx),
    ]);
    const html = renderAccountStatementHtml(statement, brand, { printButton: true });
    void reply.header('Content-Type', 'text/html; charset=utf-8');
    void reply.header(
      'Content-Disposition',
      `inline; filename="statement-${statement.period.from}-to-${statement.period.to}.html"`
    );
    return reply.send(html);
  });

  app.post('/v1/b2b/accounts/:id/statement/send', async (request) => {
    requireRole(request, 'editor');
    await requireB2bModule(request);
    const { id } = PathId.parse(request.params);
    const period = Period.parse(request.body ?? {});
    return ok(await sendAccountStatement(request, id, period));
  });

  return Promise.resolve();
};

export default b2bStatementRoutes;
