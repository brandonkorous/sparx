// `platform.notify` — write an in-app notification (docs/124 Phase 3).
//
// The in-app sibling of `email.send_internal`: same "tell the team" intent, a
// different channel. It lives as an automation ACTION rather than in a bespoke
// notification worker for two reasons, and the second is the important one:
//
//   1. The engine already consumes the entire event firehose (the
//      `automation.trigger` fan-in), so a second subscriber would have been a
//      whole Cloud Run service duplicating work already being done.
//   2. Notification policy is exactly what a rule engine is for. "Tell the
//      owners when a payment fails, but not for orders under $5, and not
//      between 11pm and 7am" is a condition set plus a gate — tenant-editable,
//      versioned, with a run ledger. Frozen in worker code it would be none of
//      those things.
//
// Fan-out is bounded by ROLE, never "everyone in the tenant": a notification
// addressed to nobody in particular is the thing people learn to ignore.

import type { ActionOutput, EffectInput, ResolvedFields, TenantCtx } from '../engine-types';
import { registerAction } from './registry';

/** Who gets told. Roles, not user ids, so a rule survives staff turnover. */
const AUDIENCES = {
  owners: ['owner'],
  admins: ['owner', 'admin'],
  staff: ['owner', 'admin', 'editor'],
} as const;

type Audience = keyof typeof AUDIENCES;

const SEVERITIES = new Set(['info', 'success', 'warning', 'danger']);

/** Hard ceiling on one action's fan-out. A rule that would notify hundreds of
 *  people is a misconfiguration, and writing hundreds of rows per event is how
 *  an inbox becomes worthless. */
const MAX_RECIPIENTS = 50;

/**
 * Fills `{{dotted.path}}` from the run's resolved fields — the SAME paths
 * conditions use (`order.total`, `customer.name`), so the notify config speaks
 * the vocabulary an author already learned rather than inventing a second one.
 *
 * An unresolved placeholder collapses to empty rather than rendering the raw
 * `{{…}}` at a person, which would read as a bug in the product.
 */
function fill(template: string, fields: ResolvedFields): string {
  return template
    .replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, path: string) => {
      const value = fields[path];
      // ONLY primitives interpolate. A resolved field can be an object or an
      // array, and `String()` would put a literal "[object Object]" in front of
      // a person — worse than saying nothing, because it reads as a broken
      // product rather than a missing detail.
      if (typeof value === 'string') return value;
      if (typeof value === 'number' || typeof value === 'boolean') return String(value);
      return '';
    })
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function readString(config: Record<string, unknown>, key: string): string | null {
  const value = config[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

async function executeNotify(ctx: TenantCtx, effect: EffectInput): Promise<ActionOutput> {
  const title = readString(effect.config, 'title');
  if (!title) throw new Error('platform.notify requires a non-empty `title`');

  const kind = readString(effect.config, 'kind') ?? 'platform.notice';
  const audienceKey = readString(effect.config, 'audience') ?? 'owners';
  const roles = AUDIENCES[audienceKey as Audience] ?? AUDIENCES.owners;

  const severityRaw = readString(effect.config, 'severity') ?? 'info';
  const severity = SEVERITIES.has(severityRaw) ? severityRaw : 'info';

  // `ctx.tx` is already tenant-scoped (RLS GUC set by withTenant), so this
  // cannot reach another tenant's staff even if a config said otherwise.
  const recipients = await ctx.tx.user.findMany({
    where: { tenantId: ctx.tenantId, role: { in: [...roles] } },
    select: { id: true },
    take: MAX_RECIPIENTS,
  });

  if (recipients.length === 0) {
    // Not a failure: a tenant with no one in that role is a real state, and
    // failing the run would stop every later action for a cosmetic reason.
    return { notified: 0, reason: 'no recipients in audience' };
  }

  const body = readString(effect.config, 'body');
  const entityId = readString(effect.config, 'entityId');

  await ctx.tx.notification.createMany({
    data: recipients.map((user) => ({
      tenantId: ctx.tenantId,
      userId: user.id,
      kind,
      title: fill(title, effect.fields).slice(0, 255),
      body: body ? fill(body, effect.fields) : null,
      module: readString(effect.config, 'module'),
      severity,
      entityType: readString(effect.config, 'entityType'),
      // Only a real uuid — a templated miss must not write a broken link.
      entityId:
        entityId && /^[0-9a-f-]{36}$/i.test(fill(entityId, effect.fields))
          ? fill(entityId, effect.fields)
          : null,
    })),
  });

  return { notified: recipients.length, kind, severity };
}

/** Registered by installBuiltinActions() — platform-level, no module gate. */
export function registerNotifyAction(): void {
  registerAction({
    type: 'platform.notify',
    module: null, // platform-level: notifications are not a paid module
    gates: [],
    manifestNote:
      'writes only an in-app row addressed to same-tenant staff resolved through the tenant-scoped tx — no egress, no spend, no cross-tenant reach, so no gate applies',
    execute: executeNotify,
  });
}
