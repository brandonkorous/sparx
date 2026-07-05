// CRM action executors (docs/81 §5.4, docs/84 Slice F1).
//
// Each executor CALLS the existing CRM service (`@sparx/crm/services`) — it never
// re-implements the write. That keeps audit logging, the published `crm.*` events,
// and the two-bus fan-out (Pub/Sub + the in-process platform bus) exactly where
// they already live: in the service. The executor's only job is to map the
// automation's `config` + the trigger entity (resolved `fields`) onto the service
// call, then return a small output for the run-step log.
//
// Gate manifest: these are internal, tenant-scoped CRM writes with no external
// side effect, so each declares an EMPTY per-action manifest with a justifying
// note (the engine requires the justification). The global gate chain still runs
// for every one — `module: 'crm'` means the module-active gate gates them when the
// CRM module is disabled, and the kill-switch / tenant-active gates always apply.

import {
  activityService,
  customerService,
  dealService,
  leadService,
  taskService,
} from '@sparx/crm/services';
import type { ActionOutput, EffectInput, TenantCtx } from '@sparx/automation';
import { registerAction } from '@sparx/automation';
import { z } from 'zod';

import {
  interpolateFields,
  optionalEntityId,
  requireEntityId,
  resolveTenantActor,
} from './entity.js';

const MS_PER_DAY = 86_400_000;

const TagConfig = z.object({
  tags: z.array(z.string().min(1)).min(1),
});

const NoteConfig = z.object({
  note: z.string().min(1),
});

const UpdateFieldConfig = z.object({
  field: z.string().min(1),
  // Required (a bare z.unknown() is non-optional in zod v4 — which is what we
  // want: an update with no value is a config error). The service's
  // UpdateCustomerInput validates the field/value pair at the boundary.
  value: z.unknown(),
});

const CreateTaskConfig = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  // Relative due date — resolved to an absolute timestamp at execution time so a
  // run that parked on an earlier wait still dates the task from when it runs.
  dueInDays: z.number().int().min(0).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  // Assignee resolution, in priority order (docs/90 §3b): a field path on the
  // trigger entity (e.g. `deal.assignedRepId`), an explicit user id, then the
  // tenant owner (the fallback — a system seed can't know a tenant's user ids).
  // `createdByUserId` is NOT NULL and a system automation has no actor, so the
  // resolved assignee doubles as the creator.
  assigneeField: z.string().min(1).optional(),
  assignedToUserId: z.string().uuid().optional(),
});

const MoveStageConfig = z.object({
  toStageId: z.string().uuid(),
});

let installed = false;

/** Register the CRM action executors exactly once (idempotent). */
export function installCrmActions(): void {
  if (installed) return;
  installed = true;

  registerAction({
    type: 'crm.add_tag',
    module: 'crm',
    gates: [],
    manifestNote: 'internal CRM write (customer tags); no external effect — global gates suffice',
    async execute(ctx: TenantCtx, effect: EffectInput): Promise<ActionOutput> {
      const cfg = TagConfig.parse(effect.config);
      const customerId = requireEntityId(effect.fields, 'customer.id', 'crm.add_tag');
      const { updatedCount } = await customerService.bulkTag(
        { tenantId: ctx.tenantId, tx: ctx.tx },
        { customerIds: [customerId], addTags: cfg.tags }
      );
      return { customerId, updatedCount };
    },
  });

  registerAction({
    type: 'crm.remove_tag',
    module: 'crm',
    gates: [],
    manifestNote: 'internal CRM write (customer tags); no external effect — global gates suffice',
    async execute(ctx: TenantCtx, effect: EffectInput): Promise<ActionOutput> {
      const cfg = TagConfig.parse(effect.config);
      const customerId = requireEntityId(effect.fields, 'customer.id', 'crm.remove_tag');
      const { updatedCount } = await customerService.bulkTag(
        { tenantId: ctx.tenantId, tx: ctx.tx },
        { customerIds: [customerId], removeTags: cfg.tags }
      );
      return { customerId, updatedCount };
    },
  });

  registerAction({
    type: 'crm.add_note',
    module: 'crm',
    gates: [],
    manifestNote: 'internal CRM write (customer activity/note); no external effect',
    async execute(ctx: TenantCtx, effect: EffectInput): Promise<ActionOutput> {
      const cfg = NoteConfig.parse(effect.config);
      const customerId = requireEntityId(effect.fields, 'customer.id', 'crm.add_note');
      const activity = await activityService.record(
        { tenantId: ctx.tenantId, tx: ctx.tx },
        {
          customerId,
          type: 'note',
          description: interpolateFields(cfg.note, effect.fields),
          actorType: 'system',
        }
      );
      return { activityId: activity.id };
    },
  });

  registerAction({
    type: 'crm.update_field',
    module: 'crm',
    gates: [],
    manifestNote:
      'internal CRM write (customer field); value validated by the service UpdateCustomerInput',
    async execute(ctx: TenantCtx, effect: EffectInput): Promise<ActionOutput> {
      const cfg = UpdateFieldConfig.parse(effect.config);
      const customerId = requireEntityId(effect.fields, 'customer.id', 'crm.update_field');
      await customerService.update({ tenantId: ctx.tenantId, tx: ctx.tx }, customerId, {
        [cfg.field]: cfg.value,
      });
      return { customerId, field: cfg.field };
    },
  });

  registerAction({
    type: 'crm.create_task',
    module: 'crm',
    gates: [],
    manifestNote: 'internal CRM write (task); no external effect',
    async execute(ctx: TenantCtx, effect: EffectInput): Promise<ActionOutput> {
      const cfg = CreateTaskConfig.parse(effect.config);
      // Anchor the task to whichever entity the trigger carried (both optional —
      // a task can stand alone). Resolve the assignee: the trigger entity's owner
      // field → an explicit id → the tenant owner. The assignee is also the creator.
      const customerId = optionalEntityId(effect.fields, 'customer.id');
      const dealId = optionalEntityId(effect.fields, 'deal.id');
      const fromField = cfg.assigneeField
        ? optionalEntityId(effect.fields, cfg.assigneeField)
        : undefined;
      const assignee = fromField ?? cfg.assignedToUserId ?? (await resolveTenantActor(ctx)).userId;
      if (!assignee) {
        throw new Error('crm.create_task: no assignee resolved and the tenant has no users.');
      }
      const dueAt =
        cfg.dueInDays !== undefined
          ? new Date(Date.now() + cfg.dueInDays * MS_PER_DAY).toISOString()
          : undefined;
      const task = await taskService.create(
        { tenantId: ctx.tenantId, userId: assignee, tx: ctx.tx },
        {
          title: interpolateFields(cfg.title, effect.fields),
          description: cfg.description
            ? interpolateFields(cfg.description, effect.fields)
            : undefined,
          dueAt,
          priority: cfg.priority,
          assignedToUserId: assignee,
          customerId,
          dealId,
        }
      );
      return { taskId: task.id };
    },
  });

  registerAction({
    type: 'crm.capture_lead',
    module: 'crm',
    gates: [],
    manifestNote:
      'internal CRM write (upsert a site-form submitter as a prospect + log the message, optionally opening a pipeline deal); no external effect — global gates suffice',
    async execute(ctx: TenantCtx, effect: EffectInput): Promise<ActionOutput> {
      // Self-gate on the form's own toggles (resolved from the server-only
      // FormDefinition). Either "add to CRM" OR "open a deal" opts the submission
      // in — opening a deal implies capturing the contact (a deal needs someone to
      // attach to). A form with neither on — or any non-form trigger without a
      // submission — is a clean no-op, not an error.
      const addToCrm = effect.fields['form.addToCrm'] === true;
      const openDeal = effect.fields['form.openDeal'] === true;
      if (!addToCrm && !openDeal) return { skipped: 'crm_off' };
      const submissionId = optionalEntityId(effect.fields, 'form.submissionId');
      if (!submissionId) return { skipped: 'no_submission' };
      // captureFormLead upserts the prospect + logs the message; openFormDeal then
      // attaches a pipeline deal. Both load the row and are idempotent, so a retry
      // is safe. Capture ALWAYS runs first (the deal needs the customer).
      const svcCtx = { tenantId: ctx.tenantId, tx: ctx.tx };
      await leadService.captureFormLead(svcCtx, { submissionId });
      if (openDeal) await leadService.openFormDeal(svcCtx, { submissionId });
      return { submissionId, openedDeal: openDeal };
    },
  });

  registerAction({
    type: 'crm.update_deal_stage',
    module: 'crm',
    gates: [],
    manifestNote: 'internal CRM write (deal stage); stage transition + events owned by the service',
    async execute(ctx: TenantCtx, effect: EffectInput): Promise<ActionOutput> {
      const cfg = MoveStageConfig.parse(effect.config);
      const dealId = requireEntityId(effect.fields, 'deal.id', 'crm.update_deal_stage');
      const deal = await dealService.moveStage({ tenantId: ctx.tenantId, tx: ctx.tx }, dealId, {
        toStageId: cfg.toStageId,
      });
      return { dealId: deal.id, stageId: deal.stageId };
    },
  });
}
