// Navigation menus.
//
//   GET /v1/navigation/menus                 → list menus for the active site
//   GET /v1/navigation/menus/:location       → header / footer / mega / custom_*
//   PUT /v1/navigation/menus/:location       → replace the whole tree
//
// All routes are property-scoped via the `x-sparx-property-id` header that the
// dashboard site switcher sets (docs/49 Phase 3). Absent header → primary site.
// The PUT writes a site-specific menu (property_id set); to create a tenant-wide
// fallback menu instead, clients must explicitly pass `?scope=tenant`.
//
// PUT is whole-tree replace rather than per-item CRUD because menu editing
// is overwhelmingly drag-reorder-and-save in one shot; per-item endpoints
// add complexity for a workflow nobody asks for. The xor constraint on
// (entry_id, external_url) is enforced both client-side and at the DB.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { withRequestTenant } from '@sparx/api-core/db';
import { ok } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { badRequest, notFound } from '@sparx/api-core/errors';
import { writeAudit } from '@sparx/api-core/audit';
import { publish } from '@sparx/api-core/pubsub';
import { resolvePropertyId } from '../../../lib/property.js';

const LocationParams = z.object({ location: z.string().min(1).max(63) });

const ItemInput: z.ZodType<MenuItemInput> = z.lazy(() =>
  z
    .object({
      label: z.string().min(1).max(255),
      entry_id: z.string().uuid().optional(),
      external_url: z.string().url().max(2048).optional(),
      open_in_new_tab: z.boolean().optional(),
      children: z.array(ItemInput).optional(),
    })
    .refine(
      (v) => (v.entry_id ? 1 : 0) + (v.external_url ? 1 : 0) === 1,
      'Exactly one of entry_id or external_url must be set.'
    )
);

interface MenuItemInput {
  label: string;
  entry_id?: string;
  external_url?: string;
  open_in_new_tab?: boolean;
  children?: MenuItemInput[];
}

const PutBody = z.object({
  name: z.string().min(1).max(120),
  items: z.array(ItemInput).max(500),
  // Optional: pass scope=tenant to create/update the tenant-wide fallback menu
  // instead of a site-specific one. Defaults to the active site.
  scope: z.enum(['site', 'tenant']).optional(),
});

const navigationRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/navigation/menus', async (request) => {
    const auth = requireRole(request, 'viewer');
    const propertyId = await resolvePropertyId(
      auth.tenantId,
      request.headers['x-sparx-property-id'] as string | undefined
    );
    const rows = await withRequestTenant(request, (tx) =>
      tx.navigationMenu.findMany({
        where: { propertyId },
        include: { items: { orderBy: { position: 'asc' } } },
        orderBy: { location: 'asc' },
      })
    );
    return ok(rows);
  });

  app.get('/v1/navigation/menus/:location', async (request) => {
    const auth = requireRole(request, 'viewer');
    const { location } = LocationParams.parse(request.params);
    const propertyId = await resolvePropertyId(
      auth.tenantId,
      request.headers['x-sparx-property-id'] as string | undefined
    );
    const row = await withRequestTenant(request, (tx) =>
      tx.navigationMenu.findFirst({
        where: { location, propertyId },
        include: { items: { orderBy: { position: 'asc' } } },
      })
    );
    if (!row) throw notFound('Menu', location);
    return ok(row);
  });

  app.put('/v1/navigation/menus/:location', async (request) => {
    const auth = requireRole(request, 'editor');
    const { location } = LocationParams.parse(request.params);
    const input = PutBody.parse(request.body);

    // Resolve the property this menu belongs to. `scope=tenant` lets editors
    // explicitly manage the tenant-wide fallback (property_id = null).
    const propertyId =
      input.scope === 'tenant'
        ? null
        : await resolvePropertyId(
            auth.tenantId,
            request.headers['x-sparx-property-id'] as string | undefined
          );

    const saved = await withRequestTenant(request, async (tx) => {
      // Replace strategy: find-or-create the menu, blow away its items, recreate.
      // Upsert can't be used here because Prisma doesn't know about the partial
      // unique indexes (property_id IS NULL / IS NOT NULL) — use findFirst + update/create.
      const existing = await tx.navigationMenu.findFirst({
        where: { tenantId: auth.tenantId, propertyId, location },
      });

      let menu;
      if (existing) {
        menu = await tx.navigationMenu.update({
          where: { id: existing.id },
          data: { name: input.name },
        });
      } else {
        menu = await tx.navigationMenu.create({
          data: { tenantId: auth.tenantId, propertyId, location, name: input.name },
        });
      }

      await tx.navigationItem.deleteMany({ where: { menuId: menu.id } });

      let position = 0;
      const insertSubtree = async (
        items: MenuItemInput[],
        parentItemId: string | null
      ): Promise<void> => {
        for (const item of items) {
          const xor = (item.entry_id ? 1 : 0) + (item.external_url ? 1 : 0);
          if (xor !== 1) {
            throw badRequest('Each item must specify exactly one of entry_id or external_url.');
          }
          const row = await tx.navigationItem.create({
            data: {
              tenantId: auth.tenantId,
              menuId: menu.id,
              parentItemId,
              position: position++,
              label: item.label,
              entryId: item.entry_id ?? null,
              externalUrl: item.external_url ?? null,
              openInNewTab: item.open_in_new_tab ?? false,
            },
          });
          if (item.children?.length) {
            await insertSubtree(item.children, row.id);
          }
        }
      };

      await insertSubtree(input.items, null);

      await writeAudit(tx, request, auth, {
        action: 'navigation.menu.updated',
        entityType: 'navigation_menu',
        entityId: menu.id,
        after: { location, itemCount: position, propertyId },
      });

      return tx.navigationMenu.findUniqueOrThrow({
        where: { id: menu.id },
        include: { items: { orderBy: { position: 'asc' } } },
      });
    });

    await publish(request.log, 'content.entry.updated', auth.tenantId, auth.actorId, {
      entityType: 'navigation_menu',
      location,
    });

    return ok(saved);
  });
  return Promise.resolve();
};

export default navigationRoutes;
