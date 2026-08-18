// The workflow-depth CRM actions (docs/144 §9).
//
// Six actions that turn the engine from "notify someone when X happens" into
// something that can actually run a process: create a record of any kind, set a
// field the tenant invented, hand work out fairly, put someone on a list, write
// the email itself, and log a call as work to do.
//
// They live apart from `crm.ts` for one reason: that file is the intake + task
// set and is already the size of a file that gets read in one sitting. Same
// conventions apply — every executor CALLS an existing service, never
// re-implements a write, and declares its gate manifest (empty + justified for a
// plain internal write, non-empty where an external effect is real).
//
// ══════════════════════════════════════════════════════════════════════════
// ONE ACTION THE PLAN ASKED FOR IS DELIBERATELY ABSENT
// ══════════════════════════════════════════════════════════════════════════
//
// docs/144 §9 lists `service.create_ticket`. It is not here, because
// `crm.create_ticket` already does exactly that job — it was built for intake
// routing in §7.4 and takes the same config, resolves the same assignee, and
// opens the same request. Shipping a second name for it would give an author two
// entries in the palette that do the same thing, and the difference between them
// would be nothing anybody could explain.

import {
  activityService,
  crmRecordService,
  customerService,
  dealService,
  engagementService,
  segmentService,
  taskService,
} from '@wizeworks/crm/services';
import type { ActionOutput, EffectInput, TenantCtx } from '@wizeworks/automation';
import { registerAction } from '@wizeworks/automation';
import { z } from 'zod';

import {
  interpolateFields,
  optionalEntityId,
  requireEntityId,
  resolveTenantActor,
} from './entity.js';

const MS_PER_DAY = 86_400_000;

// ─── crm.create_record ───────────────────────────────────────────────────────

const CreateRecordConfig = z.object({
  /** Which object. `contact`, `deal`, or a key the tenant invented (docs/144 §3)
   *  — the whole point is that the engine does not know the list at build time. */
  objectKey: z.string().min(2).max(63),
  /** What to call it. Merge tokens resolve against the trigger entity, so
   *  "Renewal — {{customer.company}}" reads correctly on the row it creates. */
  title: z.string().min(1).max(255).optional(),
  /** Field values. Every string is interpolated; everything else passes through
   *  as authored, so a number stays a number. */
  values: z.record(z.string(), z.unknown()).default({}),
  /** Link the new row to whatever triggered the rule. On by default: a record
   *  created by an automation and attached to nothing is a record nobody finds. */
  linkToTrigger: z.boolean().default(true),
});

/** Interpolate every STRING value in a config bag, leaving other types alone.
 *  A merge token in a number field is an authoring mistake, and silently
 *  stringifying the field to accommodate it would store "42" where 42 belongs. */
function interpolateValues(
  values: Record<string, unknown>,
  fields: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values)) {
    out[key] = typeof value === 'string' ? interpolateFields(value, fields) : value;
  }
  return out;
}

// ─── crm.set_property ────────────────────────────────────────────────────────

const SetPropertyConfig = z.object({
  /** Which record to write to. Defaults to the trigger's own entity, which is
   *  what an author means nine times in ten. */
  target: z.enum(['contact', 'deal', 'record']).default('contact'),
  property: z.string().min(1).max(63),
  value: z.unknown(),
  /** Treat `property` as one of the tenant's own declared fields rather than a
   *  built-in column. Separate flag rather than a naming convention, because a
   *  tenant is entitled to invent a property called `company`. */
  custom: z.boolean().default(true),
});

// ─── crm.rotate_owner ────────────────────────────────────────────────────────

const RotateOwnerConfig = z.object({
  target: z.enum(['contact', 'deal']).default('deal'),
  /** Who is in the rotation. Empty = every user on the tenant, which is the
   *  right default for a small team and the wrong one for a large business —
   *  hence the field. */
  userIds: z.array(z.string().uuid()).max(50).default([]),
});

// ─── crm.add_to_list ─────────────────────────────────────────────────────────

const AddToListConfig = z.object({
  segmentId: z.string().uuid(),
  /** Take them OFF instead. One action for both directions: an author writing
   *  "when they buy, move them off the prospects list" should not have to find a
   *  second entry in the palette. */
  remove: z.boolean().default(false),
});

// ─── engagement.send_email ───────────────────────────────────────────────────

const SendEmailConfig = z.object({
  subject: z.string().min(1).max(998),
  bodyHtml: z.string().min(1).max(500_000),
  /** Bumps the template's counters, which is how a business finds out which of
   *  its templates actually gets replies. */
  templateId: z.string().uuid().optional(),
  /** Send through a connected mailbox so it lands in that person's Sent folder
   *  and reads as coming from them rather than from the system. */
  mailboxConnectionId: z.string().uuid().optional(),
  /** Continue the conversation the trigger came from, when there is one. */
  replyToThread: z.boolean().default(true),
});

// ─── voice.log_call_task ─────────────────────────────────────────────────────

const LogCallTaskConfig = z.object({
  title: z.string().min(1).max(255).default('Call them back'),
  description: z.string().max(10_000).optional(),
  dueInDays: z.number().int().min(0).max(365).default(0),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('high'),
  /** Who owes the call. Same resolution order as crm.create_task: a field on the
   *  trigger entity, then an explicit id, then the tenant owner. */
  assigneeField: z.string().min(1).optional(),
  assignedToUserId: z.string().uuid().optional(),
});

export function installCrmDepthActions(): void {
  registerAction({
    type: 'crm.create_record',
    module: 'crm',
    gates: [],
    manifestNote:
      'internal CRM write (a row of any object, including one the tenant invented); values validated by the object definition at the service boundary; no external effect',
    async execute(ctx: TenantCtx, effect: EffectInput): Promise<ActionOutput> {
      const cfg = CreateRecordConfig.parse(effect.config);
      const svcCtx = { tenantId: ctx.tenantId, tx: ctx.tx };
      const values = interpolateValues(cfg.values, effect.fields);
      const title = cfg.title ? interpolateFields(cfg.title, effect.fields) : undefined;

      // `contact` and `deal` are real tables with real services; everything else
      // is a tenant-invented object living in crm_records. Routing here rather
      // than making crmRecordService handle the built-ins keeps each write on the
      // service that owns its events, audit rows and validation.
      if (cfg.objectKey === 'contact') {
        const customer = await customerService.create(svcCtx, {
          ...values,
          ...(title ? { company: values.company ?? title } : {}),
        });
        return { objectKey: 'contact', recordId: customer.id };
      }

      if (cfg.objectKey === 'deal') {
        const deal = await dealService.create(svcCtx, {
          ...values,
          title: title ?? 'New opportunity',
          ...(cfg.linkToTrigger
            ? { customerId: optionalEntityId(effect.fields, 'customer.id') }
            : {}),
        });
        return { objectKey: 'deal', recordId: deal.id };
      }

      const record = await crmRecordService.create(svcCtx, {
        objectKey: cfg.objectKey,
        title,
        values,
        ...(cfg.linkToTrigger
          ? {
              customerId: optionalEntityId(effect.fields, 'customer.id'),
              dealId: optionalEntityId(effect.fields, 'deal.id'),
            }
          : {}),
      });
      return { objectKey: cfg.objectKey, recordId: record.id };
    },
  });

  registerAction({
    type: 'crm.set_property',
    module: 'crm',
    gates: [],
    manifestNote:
      'internal CRM write (one field on the trigger entity); the value is validated against the tenant object definition by the service; no external effect',
    async execute(ctx: TenantCtx, effect: EffectInput): Promise<ActionOutput> {
      const cfg = SetPropertyConfig.parse(effect.config);
      const svcCtx = { tenantId: ctx.tenantId, tx: ctx.tx };
      const value =
        typeof cfg.value === 'string' ? interpolateFields(cfg.value, effect.fields) : cfg.value;

      // A custom property goes in `customProperties`, where the tenant's own
      // FieldSchema validates it; a built-in goes on the column. Writing a
      // declared property to a column would fail on a name that isn't one, and
      // writing a built-in into the JSON bag would put it somewhere no list
      // column or filter reads.
      const patch = cfg.custom
        ? { customProperties: { [cfg.property]: value } }
        : { [cfg.property]: value };

      if (cfg.target === 'deal') {
        const dealId = requireEntityId(effect.fields, 'deal.id', 'crm.set_property');
        await dealService.update(svcCtx, dealId, patch);
        return { target: 'deal', recordId: dealId, property: cfg.property };
      }
      if (cfg.target === 'record') {
        const recordId = requireEntityId(effect.fields, 'record.id', 'crm.set_property');
        await crmRecordService.update(svcCtx, recordId, { values: { [cfg.property]: value } });
        return { target: 'record', recordId, property: cfg.property };
      }
      const customerId = requireEntityId(effect.fields, 'customer.id', 'crm.set_property');
      await customerService.update(svcCtx, customerId, patch);
      return { target: 'contact', recordId: customerId, property: cfg.property };
    },
  });

  registerAction({
    type: 'crm.rotate_owner',
    module: 'crm',
    gates: [],
    manifestNote:
      "internal CRM write (assignment); no external effect — the person is told by a separate notify action, which is the tenant's choice to add",
    async execute(ctx: TenantCtx, effect: EffectInput): Promise<ActionOutput> {
      const cfg = RotateOwnerConfig.parse(effect.config);
      const svcCtx = { tenantId: ctx.tenantId, tx: ctx.tx };

      const pool = cfg.userIds.length > 0 ? cfg.userIds : await tenantUserIds(ctx);
      if (pool.length === 0) {
        throw new Error('crm.rotate_owner: nobody to assign to — the rotation is empty.');
      }

      const next = await nextInRotation(ctx, cfg.target, pool);

      if (cfg.target === 'deal') {
        const dealId = requireEntityId(effect.fields, 'deal.id', 'crm.rotate_owner');
        await dealService.update(svcCtx, dealId, { assignedRepId: next });
        return { target: 'deal', recordId: dealId, assignedTo: next };
      }
      const customerId = requireEntityId(effect.fields, 'customer.id', 'crm.rotate_owner');
      await customerService.update(svcCtx, customerId, { assignedRepId: next });
      return { target: 'contact', recordId: customerId, assignedTo: next };
    },
  });

  registerAction({
    type: 'crm.add_to_list',
    module: 'crm',
    gates: [],
    manifestNote:
      'internal CRM write (static list membership + its history row); refuses on a rule-driven list at the service boundary; no external effect',
    async execute(ctx: TenantCtx, effect: EffectInput): Promise<ActionOutput> {
      const cfg = AddToListConfig.parse(effect.config);
      const customerId = requireEntityId(effect.fields, 'customer.id', 'crm.add_to_list');
      const svcCtx = { tenantId: ctx.tenantId, tx: ctx.tx };

      // `source: 'automation'` is what makes the list's history readable later:
      // "who put these forty people on here" is answerable without anyone
      // remembering which rule was running that week.
      if (cfg.remove) {
        const result = await segmentService.removeMembers(
          svcCtx,
          cfg.segmentId,
          { customerIds: [customerId] },
          'automation'
        );
        return { segmentId: cfg.segmentId, removed: result.removed };
      }
      const result = await segmentService.addMembers(
        svcCtx,
        cfg.segmentId,
        { customerIds: [customerId] },
        'automation'
      );
      return { segmentId: cfg.segmentId, added: result.added };
    },
  });

  registerAction({
    type: 'engagement.send_email',
    module: 'crm',
    gates: [],
    manifestNote:
      'sends ONE email to ONE person through engagementService, which enforces do-not-contact and reads the address off the record rather than the config; suppression + sending policy live at the email capability boundary the service already goes through',
    async execute(ctx: TenantCtx, effect: EffectInput): Promise<ActionOutput> {
      const cfg = SendEmailConfig.parse(effect.config);
      const customerId = requireEntityId(effect.fields, 'customer.id', 'engagement.send_email');

      const result = await engagementService.sendEmail(
        { tenantId: ctx.tenantId, tx: ctx.tx },
        {
          customerId,
          subject: interpolateFields(cfg.subject, effect.fields),
          bodyHtml: interpolateFields(cfg.bodyHtml, effect.fields),
          dealId: optionalEntityId(effect.fields, 'deal.id') ?? null,
          ticketId: optionalEntityId(effect.fields, 'ticket.id') ?? null,
          // Replying keeps the customer's own conversation in one place instead
          // of starting a parallel thread they have to reconcile by hand.
          threadId: cfg.replyToThread
            ? (optionalEntityId(effect.fields, 'engagement.threadId') ?? null)
            : null,
          templateId: cfg.templateId ?? null,
          mailboxConnectionId: cfg.mailboxConnectionId ?? null,
        }
      );
      return { threadId: result.thread.id, messageId: result.message.id };
    },
  });

  registerAction({
    type: 'voice.log_call_task',
    module: 'crm',
    gates: [],
    manifestNote:
      'internal CRM write (a task to call someone back, plus the activity recording why); places no call and touches no voice provider — the name says log, not dial',
    async execute(ctx: TenantCtx, effect: EffectInput): Promise<ActionOutput> {
      const cfg = LogCallTaskConfig.parse(effect.config);
      const svcCtx = { tenantId: ctx.tenantId, tx: ctx.tx };
      const customerId = optionalEntityId(effect.fields, 'customer.id');
      const dealId = optionalEntityId(effect.fields, 'deal.id');

      const fromField = cfg.assigneeField
        ? optionalEntityId(effect.fields, cfg.assigneeField)
        : undefined;
      const assignee = fromField ?? cfg.assignedToUserId ?? (await resolveTenantActor(ctx)).userId;
      if (!assignee) {
        throw new Error('voice.log_call_task: no assignee resolved and the tenant has no users.');
      }

      const task = await taskService.create(
        { tenantId: ctx.tenantId, userId: assignee, tx: ctx.tx },
        {
          title: interpolateFields(cfg.title, effect.fields),
          description: cfg.description
            ? interpolateFields(cfg.description, effect.fields)
            : undefined,
          dueAt: new Date(Date.now() + cfg.dueInDays * MS_PER_DAY).toISOString(),
          priority: cfg.priority,
          assignedToUserId: assignee,
          customerId,
          dealId,
        }
      );

      // The task says what to do; the activity says why it appeared. Without the
      // second, a rep opens a call-back task with no idea what prompted it.
      if (customerId) {
        await activityService.record(svcCtx, {
          customerId,
          dealId,
          type: 'call.scheduled',
          description: `Call-back scheduled: ${task.title}`,
          actorType: 'system',
        });
      }

      return { taskId: task.id, assignedTo: assignee };
    },
  });
}

/** Every user on the tenant — the default rotation. */
async function tenantUserIds(ctx: TenantCtx): Promise<string[]> {
  const members = await ctx.tx.member.findMany({
    where: { organizationId: ctx.tenantId },
    select: { userId: true },
    orderBy: { createdAt: 'asc' },
  });
  return members.map((m) => m.userId);
}

/**
 * Whose turn it is.
 *
 * Round-robin from the CURRENT STATE rather than from a stored counter: pick
 * whoever in the pool holds the fewest open records, breaking ties by pool order.
 * A counter would drift the moment anything else assigned work — a rep taking a
 * deal by hand, an import, a second rotation rule — and would then spend weeks
 * "catching up" by dumping everything on one person. Counting is O(pool) once per
 * assignment and cannot drift, because it is derived from the thing it is trying
 * to balance.
 */
async function nextInRotation(
  ctx: TenantCtx,
  target: 'contact' | 'deal',
  pool: string[]
): Promise<string> {
  const counts =
    target === 'deal'
      ? await ctx.tx.deal.groupBy({
          by: ['assignedRepId'],
          where: { assignedRepId: { in: pool }, closedAt: null, deletedAt: null },
          _count: { _all: true },
        })
      : await ctx.tx.customer.groupBy({
          by: ['assignedRepId'],
          where: { assignedRepId: { in: pool }, deletedAt: null },
          _count: { _all: true },
        });

  const byUser = new Map<string, number>(pool.map((id) => [id, 0]));
  for (const row of counts) {
    if (row.assignedRepId) byUser.set(row.assignedRepId, row._count._all);
  }

  let best = pool[0]!;
  let bestCount = byUser.get(best) ?? 0;
  for (const id of pool) {
    const count = byUser.get(id) ?? 0;
    if (count < bestCount) {
      best = id;
      bestCount = count;
    }
  }
  return best;
}
