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
 * `{{…}}` at a person, which would read as a bug in the product. It is also
 * REPORTED, because collapsing quietly is how "{{product.title}} is out of
 * stock" reached an owner's bell as " is out of stock" — see `executeNotify`.
 */
function fill(template: string, fields: ResolvedFields): { text: string; missing: string[] } {
  const missing: string[] = [];
  const text = template
    .replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, path: string) => {
      const value = fields[path];
      // ONLY primitives interpolate. A resolved field can be an object or an
      // array, and `String()` would put a literal "[object Object]" in front of
      // a person — worse than saying nothing, because it reads as a broken
      // product rather than a missing detail.
      if (typeof value === 'string' && value.length > 0) return value;
      if (typeof value === 'number' || typeof value === 'boolean') return String(value);
      missing.push(path);
      return '';
    })
    .replace(/\s{2,}/g, ' ')
    .trim();
  return { text, missing };
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

  const filledTitle = fill(title, effect.fields);
  // A title is not decoration — it IS the notification, and every one of these
  // templates puts the SUBJECT in a placeholder. Lose it and the row reads
  // " is out of stock" over a body that says "customers cannot buy this",
  // where "this" names nothing; the reader is told something is wrong and
  // denied the one word that would let them act. So: write nothing, and say in
  // the run ledger which path came back empty.
  //
  // The same reasoning the `entityId` guard below already applies. It was
  // written for the broken LINK and left the broken SENTENCE alone, which is
  // the more important of the two. Guarding the title rather than each
  // resolver is what makes it hold: a missing field is a per-event mistake
  // somebody has to remember not to make, and this one was made twice — see
  // `ORDER_EVENTS` in the builtins resolver, where `order.payment_failed` had
  // to be added after the same seed shipped "Payment failed on order ".
  //
  // Body is deliberately NOT guarded: it is supporting prose, the title
  // carries the fact, and a notification is worth sending with a thin second
  // line.
  if (filledTitle.missing.length > 0) {
    return { notified: 0, reason: `title unresolved: ${filledTitle.missing.join(', ')}` };
  }

  const filledEntityId = entityId ? fill(entityId, effect.fields).text : null;

  await ctx.tx.notification.createMany({
    data: recipients.map((user) => ({
      tenantId: ctx.tenantId,
      userId: user.id,
      kind,
      title: filledTitle.text.slice(0, 255),
      body: body ? fill(body, effect.fields).text : null,
      module: readString(effect.config, 'module'),
      severity,
      entityType: readString(effect.config, 'entityType'),
      // Only a real uuid — a templated miss must not write a broken link.
      entityId: filledEntityId && /^[0-9a-f-]{36}$/i.test(filledEntityId) ? filledEntityId : null,
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
