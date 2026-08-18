// CRM company GraphQL resolvers (docs/144 §11).

import { companyService } from '@wizeworks/crm';
import { requireRole } from '@wizeworks/api-core/auth';
import type { GqlContext } from '../types';
import { requireCrmModule, toCrmContext } from '../../../lib/crm-context.js';

interface ListArgs {
  status?: 'active' | 'credit_hold' | 'suspended' | 'inactive';
  q?: string;
  take?: number;
  skip?: number;
}

export const companyQueryResolvers = {
  companies: async (_p: unknown, args: ListArgs, ctx: GqlContext) => {
    requireRole(ctx.request, 'viewer');
    await requireCrmModule(ctx.request);
    return companyService.list(toCrmContext(ctx.request), args);
  },

  company: async (_p: unknown, args: { id: string }, ctx: GqlContext) => {
    requireRole(ctx.request, 'viewer');
    await requireCrmModule(ctx.request);
    return companyService.get(toCrmContext(ctx.request), args.id);
  },
};

export const companyMutationResolvers = {
  createCompany: async (_p: unknown, args: { input: unknown }, ctx: GqlContext) => {
    requireRole(ctx.request, 'editor');
    await requireCrmModule(ctx.request);
    return companyService.create(toCrmContext(ctx.request), args.input);
  },

  updateCompany: async (_p: unknown, args: { id: string; input: unknown }, ctx: GqlContext) => {
    requireRole(ctx.request, 'editor');
    await requireCrmModule(ctx.request);
    return companyService.update(toCrmContext(ctx.request), args.id, args.input);
  },

  archiveCompany: async (_p: unknown, args: { id: string }, ctx: GqlContext) => {
    requireRole(ctx.request, 'admin');
    await requireCrmModule(ctx.request);
    await companyService.softDelete(toCrmContext(ctx.request), args.id);
    return true;
  },
};
