// Operator tenant WRITE actions (docs/apps/admin/build-plan.md §5 Slice 8). The
// cross-tenant surface where a WizeWorks operator takes bounded, audited actions
// on a tenant: module activate/deactivate (`module:toggle`), suspend/unsuspend
// (`tenant:suspend`), and storage-limit overrides (`tenant:suspend`). Same
// Layer-5 shared-secret auth as the other operator routes; the admin app is the
// capability gate + wize_admin audit writer.
//
// F4 (build-plan §8): a module toggle is an EVENT, never an inline flag write.
// The module route drives the tenant's OWN toggle path via the shared
// `lib/module-toggle` helper — so the seeding consumers (CRM pipeline/segments,
// default emails, system automations) and the Stripe subscription-item sync run
// EXACTLY as when the tenant flips the switch itself. The module-transition
// event carries `actorId: null` (platform-initiated — an operator is not a
// tenant user); the operator attribution lives in the two audit trails instead.
//
// Attribution is written BOTH ways (build-plan §7.5, F4):
//   • the TENANT's own `audit_logs` — actor_type='operator', actor_id=<operator
//     uuid> — so the tenant owner sees WizeWorks-initiated changes to their account;
//   • the wize_admin operator audit — written admin-side (api-rest, as sparx_app,
//     cannot reach the wize_admin schema).
//
// SCOPE (build-plan Slice 8 decisions): suspend is STATUS-ONLY — it flips
// `tenants.status` and logs it, but no request path yet BLOCKS a suspended
// tenant; the storage-limit is STORED + DISPLAYED but not yet enforced at the
// upload path. Both enforcement layers are scoped follow-ups in
// docs/apps/admin/slice-8-enforcement-followups.md.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma, withTenant, type Prisma } from '@wizeworks/db';
import { deriveModuleStates, blockingDependents, type ModuleSlug } from '@wizeworks/auth';
import { MODULE_MONTHLY_CENTS } from '@wizeworks/billing';
import type {
  OperatorModuleToggleResult,
  OperatorTenantModule,
  OperatorTenantStatusResult,
  OperatorStorageLimitResult,
} from '@wizeworks/operator';

import {
  authorizeOperator,
  badRequest,
  notFound,
  operatorIdOf,
  HttpError,
} from './operator-internal.js';
import {
  MODULE_SLUG_SET,
  moduleBlockedMessage,
  toggleTenantModule,
} from '../../lib/module-toggle.js';
import { readStorageLimitBytes, withStorageLimitBytes } from '../../lib/tenant-limits.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ToggleSchema = z.object({ enabled: z.boolean() });
const SuspendSchema = z.object({
  suspended: z.boolean(),
  reason: z.string().max(2000).optional(),
});
const StorageLimitSchema = z.object({ limitBytes: z.number().int().nonnegative().nullable() });

/** The tenant's full module breakdown, in the shape the tenant-detail view
 *  renders (mirrors `deriveModuleStates` + the billing price map). */
function moduleBreakdown(settings: unknown): OperatorTenantModule[] {
  const states = deriveModuleStates(settings);
  return (Object.keys(states) as ModuleSlug[]).map((key) => ({
    key,
    enabled: states[key].enabled,
    source: states[key].source,
    includedBy: states[key].includedBy,
    requiredBy: blockingDependents(key, (m) => states[m].enabled),
    monthlyCents: states[key].source === 'explicit' ? (MODULE_MONTHLY_CENTS[key] ?? 0) : 0,
  }));
}

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature
const operatorTenantRoutes: FastifyPluginAsync = async (app) => {
  const opts = { logLevel: 'warn' as const, schema: { hide: true } };

  // Manually activate/deactivate a module for a tenant.
  app.patch<{ Params: { id: string; slug: string } }>(
    '/internal/operator/tenants/:id/modules/:slug',
    opts,
    async (request) => {
      authorizeOperator(request);
      const { id, slug } = request.params;
      if (!UUID_RE.test(id)) throw badRequest('Invalid tenant id.');
      if (!MODULE_SLUG_SET.has(slug)) throw badRequest(`Unknown module slug: ${slug}`);

      const parsed = ToggleSchema.safeParse(request.body);
      if (!parsed.success) throw badRequest('`enabled` must be a boolean.');
      const { enabled } = parsed.data;
      const operatorId = operatorIdOf(request);
      const target = slug as ModuleSlug;

      const before = await prisma.tenant.findUnique({
        where: { id },
        select: { settings: true },
      });
      if (!before) throw notFound('Tenant not found.');

      const beforeEnabled = deriveModuleStates(before.settings)[target].enabled;

      // Drive the tenant's own toggle mechanic (event announce + seed + Stripe
      // sync). actorId=null → platform-initiated; the operator is attributed via
      // the audit rows below, not the domain event.
      const result = await toggleTenantModule({
        log: request.log,
        tenantId: id,
        actorId: null,
        slug: target,
        enabled,
        beforeSettings: before.settings,
      });
      if (result.blocked.length) {
        throw new HttpError(409, 'MODULE_BLOCKED', moduleBlockedMessage(result.blocked, target));
      }

      const afterStates = deriveModuleStates(result.settings);
      const afterEnabled = afterStates[target].enabled;

      // Stamp the TENANT's own audit_logs (owner-visible) — only on a real
      // transition, so a redundant toggle leaves no misleading trail. entity_id is
      // a uuid column, so the module slug rides in the diff, not there.
      if (result.changed) {
        await withTenant({ tenantId: id }, async (tx) => {
          await tx.auditLog.create({
            data: {
              tenantId: id,
              actorId: operatorId,
              actorType: 'operator',
              action: enabled ? 'module.activated' : 'module.deactivated',
              entityType: 'module',
              entityId: null,
              diff: {
                before: { module: target, enabled: beforeEnabled },
                after: { module: target, enabled: afterEnabled },
              },
              ipAddress: null,
              userAgent: null,
            },
          });
        });
      }

      const response: OperatorModuleToggleResult = {
        slug: target,
        enabled: afterEnabled,
        changed: result.changed,
        modules: moduleBreakdown(result.settings),
      };
      return response;
    }
  );

  // Suspend / unsuspend a tenant — STATUS-ONLY (no request path blocks a
  // suspended tenant yet; enforcement is a scoped follow-up). Writes the status
  // on the non-RLS dispatch row and records it in the tenant's own activity log.
  app.patch<{ Params: { id: string } }>(
    '/internal/operator/tenants/:id/status',
    opts,
    async (request) => {
      authorizeOperator(request);
      const { id } = request.params;
      if (!UUID_RE.test(id)) throw badRequest('Invalid tenant id.');

      const parsed = SuspendSchema.safeParse(request.body);
      if (!parsed.success) throw badRequest('`suspended` must be a boolean.');
      const { suspended, reason } = parsed.data;
      const operatorId = operatorIdOf(request);

      const before = await prisma.tenant.findUnique({ where: { id }, select: { status: true } });
      if (!before) throw notFound('Tenant not found.');

      const nextStatus = suspended ? 'suspended' : 'active';
      if (before.status !== nextStatus) {
        await prisma.tenant.update({ where: { id }, data: { status: nextStatus } });
        await withTenant({ tenantId: id }, async (tx) => {
          await tx.auditLog.create({
            data: {
              tenantId: id,
              actorId: operatorId,
              actorType: 'operator',
              action: suspended ? 'tenant.suspended' : 'tenant.unsuspended',
              entityType: 'tenant',
              entityId: id,
              diff: {
                before: { status: before.status },
                after: { status: nextStatus },
                ...(reason ? { reason } : {}),
              },
              ipAddress: null,
              userAgent: null,
            },
          });
        });
      }

      const response: OperatorTenantStatusResult = { status: nextStatus };
      return response;
    }
  );

  // Set / clear a tenant's storage-cap override (bytes; null clears it). STORED +
  // DISPLAYED only — the upload-path enforcement is a scoped follow-up. RMW on
  // `settings.limits.storageBytes` (non-RLS dispatch row).
  app.patch<{ Params: { id: string } }>(
    '/internal/operator/tenants/:id/storage-limit',
    opts,
    async (request) => {
      authorizeOperator(request);
      const { id } = request.params;
      if (!UUID_RE.test(id)) throw badRequest('Invalid tenant id.');

      const parsed = StorageLimitSchema.safeParse(request.body);
      if (!parsed.success) {
        throw badRequest('`limitBytes` must be a non-negative integer or null.');
      }
      const { limitBytes } = parsed.data;
      const operatorId = operatorIdOf(request);

      const before = await prisma.tenant.findUnique({ where: { id }, select: { settings: true } });
      if (!before) throw notFound('Tenant not found.');

      const beforeLimit = readStorageLimitBytes(before.settings);
      if (beforeLimit !== limitBytes) {
        const nextSettings = withStorageLimitBytes(before.settings, limitBytes);
        await prisma.tenant.update({
          where: { id },
          data: { settings: nextSettings as Prisma.InputJsonValue },
        });
        await withTenant({ tenantId: id }, async (tx) => {
          await tx.auditLog.create({
            data: {
              tenantId: id,
              actorId: operatorId,
              actorType: 'operator',
              action:
                limitBytes === null ? 'tenant.storage_limit.cleared' : 'tenant.storage_limit.set',
              entityType: 'tenant',
              entityId: id,
              diff: {
                before: { storageLimitBytes: beforeLimit },
                after: { storageLimitBytes: limitBytes },
              },
              ipAddress: null,
              userAgent: null,
            },
          });
        });
      }

      const response: OperatorStorageLimitResult = { limitBytes };
      return response;
    }
  );
};

export default operatorTenantRoutes;
