// GET /v1/integrations — every outside service this business can connect, and the
// ones it already has, in one answer.
//
// WHY ONE ROUTE. The catalog used to be six, each owned by the module that happened
// to implement it: `/v1/commerce/providers/available` for carriers and tax,
// `/v1/commerce/payments/gateways` for processors, `/v1/channels` for marketplaces,
// `/v1/social/connections` for social, dropship under its own module, AI under
// another. A tenant had to already know which module owned a thing to find where to
// connect it — which is how "how do I get paid" ended up four tabs deep under
// commerce while the panel literally called Integrations showed two carriers.
//
// The catalog half comes from the shared plane (@wizeworks/integrations), so this route
// never enumerates vendors: whatever registered at boot is what it returns, first-
// party or contributed. The connection half is per-category, because each domain
// stores its own connections in its own table and that is correct — the tables carry
// different columns because the things are different.
//
// MODULE GATING IS PER CATEGORY, NOT PER ROUTE. This route is not behind the commerce
// module. Categories a tenant cannot use come back `unlocked: false` with the reason,
// so the panel can show the whole shelf and explain what is switched off rather than
// answering MODULE_DISABLED for everything. That also fixes a plain bug: payments sat
// behind the commerce gate, so an invoicing-only or scheduling-only tenant could not
// reach the payment catalog at all — despite both needing to get paid.

import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { ok } from '@wizeworks/api-core/envelope';
import { requireAuth, requireRole } from '@wizeworks/api-core/auth';
import { withRequestTenant } from '@wizeworks/api-core/db';
import { isModuleEnabled } from '@wizeworks/auth';
import {
  allCategories,
  isCategoryUnlocked,
  listIntegrationDescriptors,
  type IntegrationCategory,
  type IntegrationDescriptor,
} from '@wizeworks/integrations';

/** What the tenant has actually done about one integration. `null` on a descriptor
 *  means "not connected" — the panel renders an invitation rather than a state. */
interface ConnectionState {
  /** The row id, so a surface can deep-link straight to the thing it manages. */
  id: string | null;
  /** Owner-facing state, resolved per category from that category's own vocabulary. */
  status: 'connected' | 'paused' | 'needs_setup' | 'not_working';
  /** A tenant's own label, when they gave one ("Stripe — EU entity"). */
  label: string | null;
}

interface IntegrationView extends IntegrationDescriptor {
  connection: ConnectionState | null;
}

interface CategoryView {
  category: IntegrationCategory;
  label: string;
  hint: string;
  unlocked: boolean;
  /** Which modules would unlock it — the panel turns this into "Turn on Invoicing or
   *  Selling to use these" rather than a bare refusal. */
  unlockedBy: readonly string[];
  integrations: IntegrationView[];
  connectedCount: number;
}

const Query = z.object({
  category: z.string().optional(),
});

/** Normalize the status vocabularies. Each store spells its states differently
 *  (`pending_configuration` vs `connecting` vs `active`) because each grew on its own;
 *  the panel should not have to learn five dialects. */
function normalizeStatus(raw: string, enabled = true): ConnectionState['status'] {
  if (!enabled) return 'paused';
  switch (raw) {
    case 'active':
      return 'connected';
    case 'errored':
    case 'error':
      return 'not_working';
    case 'disabled':
    case 'disconnected':
      return 'paused';
    default:
      // pending_configuration | pending_oauth | pending_verification | connecting
      return 'needs_setup';
  }
}

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync demands async; registration itself is sync.
const integrationRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/integrations', async (request) => {
    requireRole(request, 'viewer');
    const auth = requireAuth(request);
    const { category: only } = Query.parse(request.query ?? {});

    // Which categories this tenant can actually use. Resolved once, per category,
    // rather than by failing the whole route on one module.
    const moduleFlags = new Map<string, boolean>();
    const moduleOn = async (slug: string): Promise<boolean> => {
      const cached = moduleFlags.get(slug);
      if (cached !== undefined) return cached;
      const enabled = await isModuleEnabled(auth.tenantId, slug as never);
      moduleFlags.set(slug, enabled);
      return enabled;
    };

    const categories = allCategories().filter((c) => !only || c.category === only);

    const activeModules: string[] = [];
    for (const info of categories) {
      for (const slug of info.modules) {
        if (await moduleOn(slug)) activeModules.push(slug);
      }
    }

    // Only read connection tables for categories the tenant can actually use — a
    // locked category has nothing to show, and this keeps a CMS-only tenant from
    // paying for five joins it will never look at.
    const wanted = new Set(
      categories.filter((c) => isCategoryUnlocked(c.category, activeModules)).map((c) => c.category)
    );
    const connections = await readConnections(request, wanted);

    const views: CategoryView[] = categories.map((info) => {
      const unlocked = isCategoryUnlocked(info.category, activeModules);
      const byCategory = connections.get(info.category) ?? new Map<string, ConnectionState>();

      const integrations = listIntegrationDescriptors({ category: info.category }).map(
        (descriptor) => ({
          ...descriptor,
          connection: byCategory.get(descriptor.slug) ?? null,
        })
      );

      return {
        category: info.category,
        label: info.label,
        hint: info.hint,
        unlocked,
        unlockedBy: info.modules,
        integrations,
        connectedCount: integrations.filter((i) => i.connection !== null).length,
      };
    });

    // An EMPTY category is not shown. `subscription_billing` and `identity` are
    // defined so a future bundle declaring those kinds lands somewhere real, but
    // nothing implements either today — and a heading with nothing under it reads as a
    // broken panel, not as a roadmap. This is the read-side form of the rule in
    // @wizeworks/integrations types.ts: a category earns its place by being dispatched.
    const shown = views.filter((c) => c.integrations.length > 0);

    return ok({
      categories: shown,
      connectedCount: shown.reduce((sum, c) => sum + c.connectedCount, 0),
    });
  });
};

/**
 * Read each unlocked category's connections from its own table.
 *
 * Deliberately NOT unified into one `integration_connections` table. The columns
 * genuinely differ — a channel connection carries a shop id and region params, a
 * social connection carries granted scopes and post targets, a provider installation
 * carries an environment and a health check — and collapsing them would mean a wide
 * table of mostly-null columns plus a JSON bag, which is the storage version of the
 * same mistake the dead payment contract made. One SHELF, many tables.
 */
async function readConnections(
  request: FastifyRequest,
  wanted: Set<IntegrationCategory>
): Promise<Map<IntegrationCategory, Map<string, ConnectionState>>> {
  const out = new Map<IntegrationCategory, Map<string, ConnectionState>>();
  const put = (category: IntegrationCategory, slug: string, state: ConnectionState) => {
    const bucket = out.get(category) ?? new Map<string, ConnectionState>();
    bucket.set(slug, state);
    out.set(category, bucket);
  };

  const needsProviders = ['shipping', 'tax', 'subscription_billing', 'identity'].some((c) =>
    wanted.has(c as IntegrationCategory)
  );

  await withRequestTenant(request, async (tx) => {
    if (needsProviders) {
      // One row per installed bundle. `kind` is what decides which shelf it lands on,
      // so a bundle installed as both shipping and tax shows under both.
      const installs = await tx.providerInstallation.findMany({
        select: {
          id: true,
          providerSlug: true,
          kind: true,
          status: true,
          enabled: true,
          label: true,
        },
      });
      for (const row of installs) {
        const category = row.kind === 'subscription_billing' ? 'subscription_billing' : row.kind;
        if (!wanted.has(category as IntegrationCategory)) continue;
        put(category as IntegrationCategory, row.providerSlug, {
          id: row.id,
          status: normalizeStatus(row.status, row.enabled),
          label: row.label,
        });
      }
    }

    if (wanted.has('payments')) {
      // One config per tenant: which gateway is live. `isActive` is the real signal —
      // a tenant can have saved keys for a gateway that is not the one checkout uses,
      // which is why the payments surface says "Keys saved — not your active provider".
      const config = await tx.tenantPaymentConfig.findFirst({
        select: { id: true, gatewayId: true, isActive: true },
      });
      if (config) {
        put('payments', config.gatewayId, {
          id: config.id,
          status: config.isActive ? 'connected' : 'needs_setup',
          label: null,
        });
      }
    }

    if (wanted.has('sales_channels')) {
      const rows = await tx.channelConnection.findMany({
        select: { id: true, channel: true, status: true },
      });
      for (const row of rows) {
        put('sales_channels', row.channel, {
          id: row.id,
          status: normalizeStatus(row.status),
          label: null,
        });
      }
    }

    if (wanted.has('social')) {
      const rows = await tx.socialConnection.findMany({
        select: { id: true, platform: true, status: true },
      });
      for (const row of rows) {
        put('social', row.platform, {
          id: row.id,
          status: normalizeStatus(row.status),
          label: null,
        });
      }
    }

    if (wanted.has('dropship')) {
      const rows = await tx.dropshipSupplier.findMany({
        where: { deletedAt: null },
        select: { id: true, type: true, status: true, name: true },
      });
      for (const row of rows) {
        put('dropship', row.type, {
          id: row.id,
          status: normalizeStatus(row.status),
          label: row.name,
        });
      }
    }

    if (wanted.has('ai')) {
      // The BYOK credential lives on `tenants.settings.ai` rather than its own table —
      // there is at most one, and it is a key plus a verification stamp.
      const tenant = await tx.tenant.findFirst({ select: { settings: true } });
      const settings = (tenant?.settings ?? {}) as Record<string, unknown>;
      const ai = settings.ai as { provider?: string; lastVerifiedAt?: string | null } | undefined;
      if (ai?.provider) {
        put('ai', ai.provider, {
          id: null,
          status: ai.lastVerifiedAt ? 'connected' : 'needs_setup',
          label: null,
        });
      }
    }
  });

  return out;
}

export default integrationRoutes;
