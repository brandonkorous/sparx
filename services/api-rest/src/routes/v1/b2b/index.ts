// Mounts every /v1/b2b/* route group.

import type { FastifyPluginAsync } from 'fastify';
import b2bAccountRoutes from './accounts.js';
import b2bPricingTierRoutes from './pricing-tiers.js';
import b2bQuoteRoutes from './quotes.js';
import b2bInvoiceRoutes from './invoices.js';
import b2bApprovalRoutes from './approval.js';

const b2bRoutes: FastifyPluginAsync = async (app) => {
  await app.register(b2bAccountRoutes);
  await app.register(b2bPricingTierRoutes);
  await app.register(b2bQuoteRoutes);
  await app.register(b2bInvoiceRoutes);
  await app.register(b2bApprovalRoutes);
};

export default b2bRoutes;
