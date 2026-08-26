// Installing the shipped library (docs/151 §9, docs/152 D3).
//
// Runs on module activation, alongside `seedSystemAutomations`, and is safe to
// re-run: matched on (property, recipeKey), so a tenant who activates commerce,
// turns it off and turns it on again has one basket-recovery campaign rather
// than three.
//
// ── WHAT A RE-RUN DOES NOT DO ────────────────────────────────────────────────
//
// It never touches a campaign that already exists. Not its name, not its steps,
// not its goal, not whether it is running. A tenant who renamed "Basket
// recovery" to "Chase the trolley", rewrote its steps and turned it on has made
// it theirs, and a seed that reconciled it back to the shipped shape would undo
// their work on a schedule nobody can see. The recipe is a starting point that
// is FORKED once; after that the row belongs to the tenant.

import { withTenant } from '@wizeworks/db';
import type { Prisma } from '@wizeworks/db';

import { recipesForModules, type FunnelRecipe } from './library.js';

export interface InstallCtx {
  tenantId: string;
}

export interface InstallResult {
  /** Recipe keys stamped as new campaigns on this run. */
  installed: string[];
  /** Already present, left exactly as the tenant has them. */
  kept: string[];
  /** Recipes whose module is not active for this tenant. Reported rather than
   *  silently absent: "we installed 2 of 7" is only meaningful with the other 5
   *  accounted for. */
  skipped: string[];
}

/**
 * Stamp every applicable recipe the tenant does not already have.
 *
 * `propertyId` is required and is the site the campaigns belong to — a funnel is
 * scoped to one business, and a tenant running two shops wants basket recovery
 * measured separately for each rather than pooled into a number that describes
 * neither.
 */
export async function installFunnelLibrary(
  ctx: InstallCtx,
  input: { propertyId: string; activeModules: readonly string[] }
): Promise<InstallResult> {
  const applicable = recipesForModules(input.activeModules);
  const skipped = FUNNEL_KEYS.filter((k) => !applicable.some((r) => r.key === k));

  const installed: string[] = [];
  const kept: string[] = [];

  for (const recipe of applicable) {
    const existing = await withTenant(ctx, (tx) =>
      tx.funnel.findFirst({
        where: {
          tenantId: ctx.tenantId,
          propertyId: input.propertyId,
          recipeKey: recipe.key,
        },
        select: { id: true },
      })
    );
    if (existing) {
      kept.push(recipe.key);
      continue;
    }
    await stamp(ctx, input.propertyId, recipe);
    installed.push(recipe.key);
  }

  return { installed, kept, skipped };
}

const FUNNEL_KEYS = recipesForModules(
  // Every module any recipe names — used only to report what was skipped.
  ['commerce', 'crm', 'b2b', 'scheduling']
).map((r) => r.key);

/** One recipe → one real row. Draft, always: a campaign that started counting
 *  people the moment a module was switched on, without anybody choosing it,
 *  would be measuring on a decision nobody made. */
async function stamp(ctx: InstallCtx, propertyId: string, recipe: FunnelRecipe): Promise<void> {
  await withTenant(ctx, (tx) =>
    tx.funnel.create({
      data: {
        tenantId: ctx.tenantId,
        propertyId,
        name: recipe.name,
        description: recipe.description,
        kind: recipe.kind,
        status: 'draft',
        stages: recipe.stages as unknown as Prisma.InputJsonValue,
        goal: recipe.goal as unknown as Prisma.InputJsonValue,
        origin: 'system',
        recipeKey: recipe.key,
        ...(recipe.stallAfterHours ? { stallAfterHours: recipe.stallAfterHours } : {}),
      },
      select: { id: true },
    })
  );
}
