// Social posting action executor (docs/133 §9, docs/134 Slice 7).
//
// `social.post` turns any event/schedule trigger into a drafted social post. It
// does NO platform I/O: it writes a SocialPost + one SocialPostTarget per enabled
// destination on the engine's own transaction (ctx.tx), so the draft commits
// atomically with the run-step record — exactly the inventory.draft_reorder_po
// pattern. Publishing happens LATER and elsewhere:
//   - not auto-approved (the default) → the post parks in `pending_approval`; a
//     human approves it from the workbench Approvals inbox ("the automation
//     drafts, the person ships").
//   - auto-approved → the post is `scheduled` at now; the api-rest scheduled
//     drain (find_due_social_posts) picks it up next tick, arms the targets, and
//     emits social.post.due for the social-worker. So this executor never touches
//     the bus — no event-inside-transaction footgun.
//
// The triggering entity is read through the resolver's shared `announce.*` field
// namespace (any "announceable" resolver — a published product, a published
// article — fills it), so the executor is entity-agnostic: it composes the body
// from a template, attaches the announce URL + hero image, and fans out to the
// tenant's enabled targets. When the tenant hasn't connected an account yet
// (no enabled target), it's a recorded no-op, never a failure — the seeded
// starter automations ship disabled and light up once an account is connected.

import {
  registerAction,
  type ActionOutput,
  type EffectInput,
  type ResolvedFields,
  type TenantCtx,
} from '@sparx/automation';
import { z } from 'zod';

import { interpolateFields } from './entity.js';

/** The default body when an automation names no template: just the headline. */
const DEFAULT_TEMPLATE = '{{announce.title}}';

const SocialPostConfig = z.object({
  /** Post body, with `{{dotted.path}}` merge tokens against the trigger's resolved
   *  fields (e.g. `{{announce.title}}`, `{{product.title}}`). */
  template: z.string().optional(),
  /** Specific `social_targets.id`s to post to; omitted/empty = every enabled target. */
  targetIds: z.array(z.string()).optional(),
  /** Override the post `source` label (defaults to the announce source type). */
  source: z.string().optional(),
  /** Attach the announce URL as the post link (default true). */
  includeLink: z.boolean().optional(),
  /** Attach the announce hero image (default true). */
  includeImage: z.boolean().optional(),
  /** Skip the approval inbox and schedule immediately (default false — park for a
   *  human). Per docs/133 §7, require-approval is the safe default; an automation
   *  opts OUT of it deliberately. Accepts a boolean OR a string ('auto' / 'true' /
   *  'yes') since the workbench select stores a string. */
  autoApprove: z.union([z.boolean(), z.string()]).optional(),
});

export type SocialPostConfig = z.infer<typeof SocialPostConfig>;

/** Parse + default the action config. */
export function parseSocialPostConfig(raw: Record<string, unknown>): SocialPostConfig {
  return SocialPostConfig.parse(raw ?? {});
}

/** Whether the config asks to skip the approval inbox. Tolerant of the string the
 *  workbench select stores ('auto') as well as a raw boolean. */
export function isAutoApprove(config: SocialPostConfig): boolean {
  const v = config.autoApprove;
  if (typeof v === 'boolean') return v;
  return v === 'auto' || v === 'true' || v === 'yes';
}

/** Read a non-empty string field, else null. */
function strOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export interface SocialDraft {
  body: string;
  link: string | null;
  mediaAssetIds: string[];
  source: string;
  sourceRef: string | null;
  propertyId: string | null;
}

/** Compose the platform-agnostic post from the config + the trigger's resolved
 *  `announce.*` fields. Pure — the DB write lives in the executor. */
export function buildSocialDraft(config: SocialPostConfig, fields: ResolvedFields): SocialDraft {
  const body = interpolateFields(config.template ?? DEFAULT_TEMPLATE, fields).trim();
  const image = config.includeImage === false ? null : strOrNull(fields['announce.imageAssetId']);
  return {
    body,
    link: config.includeLink === false ? null : strOrNull(fields['announce.url']),
    mediaAssetIds: image ? [image] : [],
    source: config.source ?? strOrNull(fields['announce.sourceType']) ?? 'automation',
    sourceRef: strOrNull(fields['announce.sourceRef']),
    propertyId: strOrNull(fields['announce.propertyId']),
  };
}

export interface SocialPostState {
  status: 'pending_approval' | 'scheduled';
  scheduledAt: Date | null;
  approvedAt: Date | null;
}

/** The lifecycle state a freshly-drafted post lands in. Auto-approve → `scheduled`
 *  at `now` (the drain publishes it); otherwise → `pending_approval` (docs/133 §7). */
export function deriveSocialPostState(autoApprove: boolean, now: Date): SocialPostState {
  if (autoApprove) {
    return { status: 'scheduled', scheduledAt: now, approvedAt: now };
  }
  return { status: 'pending_approval', scheduledAt: null, approvedAt: null };
}

let installed = false;

/** Register the social action executor exactly once (idempotent). */
export function installSocialActions(): void {
  if (installed) return;
  installed = true;

  registerAction({
    type: 'social.post',
    module: 'social',
    gates: [],
    manifestNote:
      'Writes a draft SocialPost + its fan-out targets only — no platform API call. ' +
      'The post parks in pending_approval (human ships it) or scheduled (the ' +
      'find_due_social_posts drain + social-worker publish it); the module-active ' +
      'gate (module: social) suffices. External send is gated downstream at publish.',
    async execute(ctx: TenantCtx, effect: EffectInput): Promise<ActionOutput> {
      const config = parseSocialPostConfig(effect.config);
      const draft = buildSocialDraft(config, effect.fields);
      if (draft.body.length === 0) {
        throw new Error(
          'social.post: the post template produced an empty body — set a message or a ' +
            '{{announce.title}} token that the trigger resolves.'
        );
      }

      // Destinations: the named targets (enabled only), or every enabled target.
      const targets = await ctx.tx.socialTarget.findMany({
        where: {
          enabled: true,
          ...(config.targetIds && config.targetIds.length > 0
            ? { id: { in: config.targetIds } }
            : {}),
        },
        select: { id: true, name: true, platform: true },
      });
      if (targets.length === 0) {
        // No connected/enabled destination yet — the seeded starters ship disabled
        // and nothing fires until an account is connected. A recorded no-op.
        return { outcome: 'no_targets', drafted: false };
      }

      const state = deriveSocialPostState(isAutoApprove(config), new Date());

      const post = await ctx.tx.socialPost.create({
        data: {
          tenantId: ctx.tenantId,
          propertyId: draft.propertyId,
          body: draft.body,
          link: draft.link,
          mediaAssetIds: draft.mediaAssetIds,
          source: draft.source,
          sourceRef: draft.sourceRef,
          status: state.status,
          scheduledAt: state.scheduledAt,
          approvedAt: state.approvedAt,
          // A system automation has no acting staff user — created + approved by
          // the platform, not a person.
          createdById: null,
          targets: {
            create: targets.map((t) => ({
              tenantId: ctx.tenantId,
              socialTargetId: t.id,
              targetName: t.name,
              platform: t.platform,
              status: 'pending',
            })),
          },
        },
        select: { id: true },
      });

      return {
        outcome: state.status === 'scheduled' ? 'scheduled' : 'pending_approval',
        drafted: true,
        postId: post.id,
        status: state.status,
        targetCount: targets.length,
      };
    },
  });
}
