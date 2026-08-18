// The weekly posting cadence (docs/social-audit slice 17).
//
// A slot is a standing intention: "we post Tuesdays at 9". It does two jobs, and the
// second is why it earns a table rather than living in settings JSON:
//
//   1. It makes a GAP visible. The calendar draws empty slots, so "we haven't posted in
//      three weeks" stops being something you notice in hindsight.
//   2. It is where the evergreen filler puts things, for the tenants who want that.
//
// A slot is a recurring LOCAL time, never a timestamp — see `cadence.ts` for why that
// distinction matters across a daylight-saving boundary.

import { withTenant } from '@wizeworks/db';
import { badRequest } from '@wizeworks/api-core/errors';

import type { SocialContext } from './context.js';

export interface PostingSlotView {
  id: string;
  propertyId: string | null;
  /** 0 = Sunday … 6 = Saturday. */
  weekday: number;
  minuteOfDay: number;
  timezone: string;
  targetIds: string[];
  enabled: boolean;
  /** Whether the evergreen filler may claim this slot, or it is plan-only. */
  autoFill: boolean;
}

function toView(row: {
  id: string;
  propertyId: string | null;
  weekday: number;
  minuteOfDay: number;
  timezone: string;
  targetIds: string[];
  enabled: boolean;
  autoFill: boolean;
}): PostingSlotView {
  return {
    id: row.id,
    propertyId: row.propertyId,
    weekday: row.weekday,
    minuteOfDay: row.minuteOfDay,
    timezone: row.timezone,
    targetIds: row.targetIds,
    enabled: row.enabled,
    autoFill: row.autoFill,
  };
}

export async function listPostingSlots(
  ctx: SocialContext,
  propertyId: string | null
): Promise<PostingSlotView[]> {
  const rows = await withTenant({ tenantId: ctx.tenantId }, (tx) =>
    tx.socialPostingSlot.findMany({
      where: {
        tenantId: ctx.tenantId,
        ...(propertyId ? { OR: [{ propertyId }, { propertyId: null }] } : {}),
      },
      orderBy: [{ weekday: 'asc' }, { minuteOfDay: 'asc' }],
    })
  );
  return rows.map(toView);
}

export interface UpsertPostingSlotInput {
  id?: string;
  propertyId?: string | null;
  weekday: number;
  minuteOfDay: number;
  timezone: string;
  targetIds: string[];
  enabled?: boolean;
  autoFill?: boolean;
}

export async function upsertPostingSlot(
  ctx: SocialContext,
  input: UpsertPostingSlotInput
): Promise<PostingSlotView> {
  if (!Number.isInteger(input.weekday) || input.weekday < 0 || input.weekday > 6) {
    throw badRequest('Pick a day of the week for this slot.');
  }
  if (!Number.isInteger(input.minuteOfDay) || input.minuteOfDay < 0 || input.minuteOfDay > 1439) {
    throw badRequest('Pick a time of day for this slot.');
  }
  // A bad zone would silently resolve every occurrence to UTC — a slot that fires at the
  // wrong hour forever and looks fine in the UI. Fail here instead.
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: input.timezone });
  } catch {
    throw badRequest(`"${input.timezone}" is not a timezone we recognize.`);
  }

  return withTenant({ tenantId: ctx.tenantId }, async (tx) => {
    // Only destinations this tenant actually owns can be scheduled into.
    const owned = await tx.socialTarget.findMany({
      where: { id: { in: input.targetIds }, tenantId: ctx.tenantId },
      select: { id: true },
    });
    const targetIds = owned.map((t) => t.id);
    if (input.autoFill && targetIds.length === 0) {
      throw badRequest('Choose at least one account before this slot can fill itself.');
    }

    const data = {
      weekday: input.weekday,
      minuteOfDay: input.minuteOfDay,
      timezone: input.timezone,
      targetIds,
      enabled: input.enabled ?? true,
      autoFill: input.autoFill ?? false,
    };

    if (input.id) {
      const existing = await tx.socialPostingSlot.findFirst({
        where: { id: input.id, tenantId: ctx.tenantId },
        select: { id: true },
      });
      if (!existing) throw badRequest('That posting time no longer exists.');
      return toView(await tx.socialPostingSlot.update({ where: { id: input.id }, data }));
    }
    return toView(
      await tx.socialPostingSlot.create({
        data: { tenantId: ctx.tenantId, propertyId: input.propertyId ?? null, ...data },
      })
    );
  });
}

export async function deletePostingSlot(ctx: SocialContext, id: string): Promise<boolean> {
  const result = await withTenant({ tenantId: ctx.tenantId }, (tx) =>
    tx.socialPostingSlot.deleteMany({ where: { id, tenantId: ctx.tenantId } })
  );
  return result.count > 0;
}
