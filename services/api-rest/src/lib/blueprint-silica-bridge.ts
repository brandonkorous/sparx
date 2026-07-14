// The onboarding→silica bridge (fixes the "every tenant's storefront shows the
// generic starter" gap). `goLiveInstall` has only ever published the LEGACY
// `BuilderNode` tree; the storefront's home/page/frame routes
// (`apps/site/lib/silica.ts`) read the SILICA columns unconditionally and
// synthesize a hardcoded generic fallback the moment those are empty — so a
// tenant onboarded via a marketplace blueprint never showed their own content.
//
// This converts the install's just-published page + layout trees
// (`page-legacy-to-silica.ts`) and materializes them through the same
// `siteService.sync`/`publish` the manual `/builder/studio` editor uses, in the
// tenant's real compiled brand theme (same theme resolution `/builder/studio`
// itself uses). Best-effort: a conversion failure must never block go-live —
// the legacy renderer stays a working fallback tier under the silica one.

import type { FastifyBaseLogger } from 'fastify';

import { withTenant } from '@sparx/db';
import { siteService } from '@sparx/builder';
import { themeService } from '@sparx/sitebuilder';
import { compileThemeForTenant, compiledToSilicaTheme } from '@sparx/site-themes';
import {
  legacyTreeToSilicaRoot,
  type BuilderNode,
  type ConversionWarning,
} from '@sparx/builder-schemas';
import { stampTree, THEME_PRESETS, type Node, type Theme } from '@wizeworks/silicaui-html';

import type { InstallContext, InstallResult } from './blueprint-installer.js';

/** The tenant's real compiled brand as a silica `Theme` — mirrors
 *  `apps/dashboard/.../builder/studio/page.tsx`'s `tenantTheme()` exactly, so a
 *  blueprint-installed site opens in the same theme the manual editor would show,
 *  not a generic preset. Degrades to the first shipped preset on any failure. */
async function resolveTenantSilicaTheme(propCtx: {
  tenantId: string;
  userId?: string;
  propertyId: string;
}): Promise<Theme> {
  try {
    const [brandRow, config] = await Promise.all([
      withTenant({ tenantId: propCtx.tenantId }, (tx) =>
        tx.tenantBrand.findUnique({ where: { tenantId: propCtx.tenantId } })
      ),
      themeService.getConfig(propCtx).catch(() => null),
    ]);
    const presentation =
      config && typeof config.draftSettings === 'object' && config.draftSettings
        ? ((config.draftSettings as Record<string, unknown>).presentation ?? null)
        : null;
    const compiled = compileThemeForTenant({
      themeKey: config?.themeKey ?? 'default',
      brand: {
        colorPrimary: brandRow?.colorPrimary ?? null,
        colorPrimaryForeground: brandRow?.colorPrimaryForeground ?? null,
        colorAccent: brandRow?.colorAccent ?? null,
        colorAccentForeground: brandRow?.colorAccentForeground ?? null,
        colorSecondary: brandRow?.colorSecondary ?? null,
        colorSecondaryForeground: brandRow?.colorSecondaryForeground ?? null,
        fontHeading: brandRow?.fontHeading ?? null,
        fontBody: brandRow?.fontBody ?? null,
        tokens: brandRow?.tokens ?? null,
      },
      presentation,
    });
    return compiledToSilicaTheme(compiled, config?.themeKey ?? 'default');
  } catch {
    return THEME_PRESETS[0]!;
  }
}

/** Convert + materialize a just-published install's pages/layout into the silica
 *  columns. Call AFTER the legacy publish loop (needs `publishedTree` populated).
 *  Every conversion warning (a dropped/degraded node) is logged, never silent. */
export async function materializeSilicaSite(
  ctx: InstallContext,
  result: InstallResult,
  logger: FastifyBaseLogger
): Promise<void> {
  const propCtx = {
    tenantId: ctx.tenantId,
    userId: ctx.userId ?? undefined,
    propertyId: ctx.propertyId,
  };
  const pageIds = (result.pages ?? []).map((p) => p.id);
  if (pageIds.length === 0) return;

  const [pageRows, layoutRow] = await withTenant({ tenantId: ctx.tenantId }, async (tx) => {
    const pages = await tx.builderPage.findMany({
      where: { id: { in: pageIds } },
      select: { id: true, name: true, slug: true, publishedTree: true },
    });
    const layout = result.layoutId
      ? await tx.builderLayout.findFirst({
          where: { id: result.layoutId },
          select: { publishedTree: true },
        })
      : null;
    return [pages, layout] as const;
  });

  const warnings: ConversionWarning[] = [];

  // Read name/slug off the live BuilderPage row, not the install result's cached
  // copy — the two disagree for the home page specifically (the row's real slug
  // is `''`; the install result's is `null`), and `getPublishedHome` matches on
  // the row's own normalized slug being empty. Falling back through
  // `slugify(name)` for a null/empty slug would give Home a non-empty slug and
  // silently break the storefront's `/` route.
  const pages = pageRows.flatMap((row) => {
    if (!row.publishedTree) return [];
    return [
      {
        id: row.id,
        name: row.name,
        slug: row.slug ?? '',
        // el()/atom() (the converter's authoring kit) mint template nodes with
        // no `id` by design — stampTree mints the globally-unique ids Studio's
        // canvas selection + Layers tree (both keyed on node id) require, same
        // as upsertPage's stampTree(pageBody(...)) call above.
        root: stampTree(
          legacyTreeToSilicaRoot(row.publishedTree as unknown as BuilderNode, warnings)
        ),
      },
    ];
  });
  if (pages.length === 0) return;

  const frame: { root: Node } | undefined = layoutRow?.publishedTree
    ? {
        root: stampTree(
          legacyTreeToSilicaRoot(layoutRow.publishedTree as unknown as BuilderNode, warnings)
        ),
      }
    : undefined;

  const theme = await resolveTenantSilicaTheme(propCtx);

  await siteService.sync(propCtx, { pages, theme, ...(frame ? { frame } : {}) });
  await siteService.publish(propCtx);

  if (warnings.length > 0) {
    logger.warn(
      { tenantId: ctx.tenantId, propertyId: ctx.propertyId, warnings },
      `silica bridge: ${warnings.length} node(s) degraded or dropped during conversion`
    );
  }
}
