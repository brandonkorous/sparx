// Mounts every /v1/finance/* route group. Two halves, and the split is the whole
// billing story for this module (docs/148 §2).
//
// MONEY IN — payments, payouts, receivables, the channel breakdown and the sparx
// bill. A LENS over money the selling modules already produced plus the platform
// bill, so these gate on order access / plain auth rather than a `finance` module
// flag. Charging to look at your own takings would be a tax on data the tenant
// already bought.
//
// MONEY OUT — the spend ledger, recurring costs, profitability and the accounting
// handoff. This is the billable `finance` module, and every route in these files
// calls `requireFinanceModule` for itself.
//
// One register call from app.ts.

import type { FastifyPluginAsync } from 'fastify';

import financePaymentRoutes from './payments.js';
import financePayoutRoutes from './payouts.js';
import financeReceivablesRoutes from './receivables.js';
import financeChannelRoutes from './channels.js';
import financeBillRoutes from './bill.js';

import financeExpenseRoutes from './expenses.js';
import financeSetupRoutes from './setup.js';
import financeRecurringRoutes from './recurring.js';
import financeProfitRoutes from './profit.js';
import financeAccountingRoutes from './accounting.js';

const financeRoutes: FastifyPluginAsync = async (app) => {
  // Money in — free, gated by the selling modules that produced the data.
  await app.register(financePaymentRoutes);
  await app.register(financePayoutRoutes);
  await app.register(financeReceivablesRoutes);
  await app.register(financeChannelRoutes);
  await app.register(financeBillRoutes);

  // Money out — the billable half (docs/148).
  await app.register(financeExpenseRoutes);
  await app.register(financeSetupRoutes);
  await app.register(financeRecurringRoutes);
  await app.register(financeProfitRoutes);
  await app.register(financeAccountingRoutes);
};

export default financeRoutes;
