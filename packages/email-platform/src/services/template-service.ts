// templateService — the BUILTIN (transactional) template surface.
//
//   builtin → code-defined React Email components in @sparx/email. Tenants
//             customize a constrained layer (subject + intro/outro slots);
//             branding is global (brand-service). The override is an
//             EmailTemplate row (source='builtin', key=<template id>).
//
// Marketing emails are authored in the Builder (docs/52, @sparx/builder's
// BuilderEmail) — the section-list "authored template" model is retired (docs/52
// §8). This service now owns builtins only.
//
// Preview + test-send resolve the tenant brand so what the tenant sees
// matches what ships. Test-send uses the synchronous escape hatch (staff-
// triggered smoke test) and stamps tenant_id for webhook attribution.

import { withTenant } from '@sparx/db';
import type { EmailTemplate, Prisma } from '@sparx/db';
import { renderTemplate, sendEmail, type DeliveryResult, type TemplateSend } from '@sparx/email';

import { writeAuditLog } from '../audit';
import { publishEmailEvent } from '../events';
import { EmailNotFoundError, type ServiceContext } from '../errors';
import { BUILTIN_TEMPLATES, getBuiltinTemplate } from '../builtin-templates';
import { SaveBuiltinOverrideInput, TestSendInput } from '../schemas/templates';
import { resolveEmailBrand } from './brand-service';
import { get as getSettings } from './settings-service';

const FALLBACK_FROM = 'Sparx <noreply@sparx.email>';

function buildFrom(fromName: string | null, fromAddress: string | null): string {
  if (!fromAddress) return process.env.SPARX_EMAIL_FROM ?? FALLBACK_FROM;
  return fromName ? `${fromName} <${fromAddress}>` : fromAddress;
}

// ── Views ──────────────────────────────────────────────────────────────────

export interface BuiltinTemplateView {
  source: 'builtin';
  key: string;
  name: string;
  kind: string;
  description: string;
  variables: string[];
  supportsSlots: boolean;
  subject: string;
  intro: string | null;
  outro: string | null;
  customized: boolean;
}

interface BuiltinSlots {
  slots?: { intro?: string; outro?: string };
}

function builtinView(catalogKey: string, override: EmailTemplate | undefined): BuiltinTemplateView {
  const catalog = getBuiltinTemplate(catalogKey);
  if (!catalog) throw new EmailNotFoundError('BuiltinTemplate', catalogKey);
  const body = (override?.body as BuiltinSlots | undefined) ?? {};
  return {
    source: 'builtin',
    key: catalog.key,
    name: catalog.name,
    kind: catalog.kind,
    description: catalog.description,
    variables: catalog.variables,
    supportsSlots: catalog.supportsSlots,
    subject: override?.subject ?? catalog.defaultSubject,
    intro: body.slots?.intro ?? null,
    outro: body.slots?.outro ?? null,
    customized: Boolean(override),
  };
}

// ── List / get ───────────────────────────────────────────────────────────

export async function list(ctx: ServiceContext): Promise<{ builtins: BuiltinTemplateView[] }> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx.emailTemplate.findMany({
      where: { source: 'builtin' },
      orderBy: { updatedAt: 'desc' },
    });
    const overrides = new Map(rows.filter((r) => r.key).map((r) => [r.key!, r]));
    const builtins = BUILTIN_TEMPLATES.map((t) => builtinView(t.key, overrides.get(t.key)));
    return { builtins };
  });
}

export async function getBuiltin(ctx: ServiceContext, key: string): Promise<BuiltinTemplateView> {
  if (!getBuiltinTemplate(key)) throw new EmailNotFoundError('BuiltinTemplate', key);
  const override = await withTenant(ctx, (tx) =>
    tx.emailTemplate.findUnique({
      where: { tenantId_key: { tenantId: ctx.tenantId, key } },
    })
  );
  return builtinView(key, override ?? undefined);
}

// ── Built-in override ────────────────────────────────────────────────────

export async function saveBuiltinOverride(
  ctx: ServiceContext,
  key: string,
  rawInput: unknown
): Promise<BuiltinTemplateView> {
  const catalog = getBuiltinTemplate(key);
  if (!catalog) throw new EmailNotFoundError('BuiltinTemplate', key);
  const input = SaveBuiltinOverrideInput.parse(rawInput);

  const body: BuiltinSlots = {
    slots: {
      ...(input.intro !== undefined ? { intro: input.intro } : {}),
      ...(input.outro !== undefined ? { outro: input.outro } : {}),
    },
  };

  const row = await withTenant(ctx, async (tx) => {
    const saved = await tx.emailTemplate.upsert({
      where: { tenantId_key: { tenantId: ctx.tenantId, key } },
      create: {
        tenantId: ctx.tenantId,
        source: 'builtin',
        key,
        kind: catalog.kind,
        name: catalog.name,
        subject: input.subject ?? catalog.defaultSubject,
        body: body as Prisma.InputJsonValue,
        status: 'active',
      },
      update: {
        ...(input.subject !== undefined ? { subject: input.subject } : {}),
        body: body as Prisma.InputJsonValue,
      },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'email.template.updated',
      entityType: 'EmailTemplate',
      entityId: saved.id,
      diff: { after: { key, subject: saved.subject } },
    });
    return saved;
  });

  await publishEmailEvent({
    tenantId: ctx.tenantId,
    topic: 'email.template.updated',
    payload: { source: 'builtin', key },
    dedupeKey: `email.template.updated:${row.id}:${row.updatedAt.toISOString()}`,
  });

  return builtinView(key, row);
}

// ── Preview + test send (builtin only) ────────────────────────────────────

export interface PreviewTarget {
  source: 'builtin';
  key: string;
}

export interface RenderedPreview {
  subject: string;
  html: string;
  text: string;
}

async function renderTarget(
  ctx: ServiceContext,
  target: PreviewTarget,
  to: string
): Promise<RenderedPreview & { templateId: string }> {
  const brand = (await resolveEmailBrand(ctx)) ?? undefined;
  const view = await getBuiltin(ctx, target.key);
  const catalog = getBuiltinTemplate(target.key);
  if (!catalog) throw new EmailNotFoundError('BuiltinTemplate', target.key);
  const props = {
    ...catalog.sampleProps,
    ...(view.intro ? { intro: view.intro } : {}),
    ...(view.outro ? { outro: view.outro } : {}),
  };
  const send = { template: target.key, to, props } as TemplateSend;
  const rendered = await renderTemplate(send, { brand });
  return {
    subject: view.subject,
    html: rendered.html,
    text: rendered.text,
    templateId: target.key,
  };
}

export async function renderPreview(
  ctx: ServiceContext,
  target: PreviewTarget
): Promise<RenderedPreview> {
  const { subject, html, text } = await renderTarget(ctx, target, 'preview@example.com');
  return { subject, html, text };
}

export async function testSend(
  ctx: ServiceContext,
  target: PreviewTarget,
  rawInput: unknown
): Promise<DeliveryResult> {
  const { to } = TestSendInput.parse(rawInput);
  const [rendered, settings] = await Promise.all([renderTarget(ctx, target, to), getSettings(ctx)]);

  // Synchronous escape hatch — staff-triggered smoke test. Stamp tenant_id so
  // any resulting webhook events attribute correctly.
  const result = await sendEmail({
    from: buildFrom(settings.fromName, settings.fromAddress),
    to,
    replyTo: settings.replyTo ?? undefined,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    templateId: rendered.templateId,
    variables: { tenant_id: ctx.tenantId },
  });
  return result;
}
