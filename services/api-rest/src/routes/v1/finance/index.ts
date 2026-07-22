// Mounts every /v1/finance/* route group — the money surfaces the workbench's
// Finance module reads. Finance is a LENS over money the selling modules already
// produced (orders, payments) plus the platform bill, not a separately-billed
// capability, so these routes gate on order access / plain auth rather than a
// `finance` module flag. One register call from app.ts.

import type { FastifyPluginAsync } from 'fastify';

import financePaymentRoutes from './payments.js';
import financePayoutRoutes from './payouts.js';
import financeReceivablesRoutes from './receivables.js';
import financeChannelRoutes from './channels.js';
import financeBillRoutes from './bill.js';

const financeRoutes: FastifyPluginAsync = async (app) => {
  await app.register(financePaymentRoutes);
  await app.register(financePayoutRoutes);
  await app.register(financeReceivablesRoutes);
  await app.register(financeChannelRoutes);
  await app.register(financeBillRoutes);
};

export default financeRoutes;
