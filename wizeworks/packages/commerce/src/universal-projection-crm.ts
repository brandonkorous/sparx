// Universal-search projectors for what an owner names in Customers and Billing
// (persona issue 261).
//
// "Search everything" found nothing for "Monday" with a board called "Monday
// numbers" on screen. Reports, boards and requests already had a home in the
// route table and a heading in the box, and nothing ever put one in the index.
// Record types, the records of a type the owner made up, print templates and
// document workflows had neither.
//
// They live here for the reason the CRM projectors in `universal-projection.ts`
// do: the indexer already depends on this package, and each projector reads
// Prisma straight through `withTenant`, so no new dependency edge is needed.
// Print templates and workflows are invoicing screens but crm tables, so they sit
// with the crm readers.
//
// Write-time signals: reports, boards, print templates and workflows from their
// services in `@wizeworks/crm`; requests, record types and records through the
// `crm.ticket.*`, `crm.object_def.*` and `crm.record.*` events the CRM bridge
// already publishes (`CRM_UNIVERSAL_BY_ENTITY` in `crm/src/pubsub-bridge.ts`).

import { ownerVisibility, reportCompiler } from '@wizeworks/crm';
import { withTenant } from '@wizeworks/db';
import {
  type EntityProjector,
  type ProjectorContext,
  type UniversalSearchDocument,
  universalId,
  VISIBLE_TO_EVERYONE,
} from '@wizeworks/search';

import { codeAsWords } from './search-words';
import { epoch, keywords, listWords, pickString, snippet } from './universal-projection-kit';

/** What a report counts, in the owner's own word for it: a renamed "Customers"
 *  reads as she renamed it, a type she made up reads as she named it. */
async function objectPlural(
  tx: Parameters<Parameters<typeof withTenant>[1]>[0],
  objectKey: string
): Promise<string> {
  const def = await tx.crmObjectDef.findFirst({
    where: { key: objectKey },
    select: { labelPlural: true },
  });
  if (def) return def.labelPlural;
  const builtin = reportCompiler.reportableObjects().find((o) => o.objectKey === objectKey);
  return builtin?.labelPlural ?? codeAsWords(objectKey);
}

interface Owned {
  ownerId: string | null;
  shared: boolean;
}

/** Who may find a board or report: everyone, or the one person who made it and
 *  kept it to herself (persona issue 264). The rule is the one the screens use. */
function visibleTo(row: Owned): string[] {
  // Asked as somebody who is nobody in particular: true means everyone.
  if (ownerVisibility.canSee(null, row) || row.ownerId === null) return [VISIBLE_TO_EVERYONE];
  return [row.ownerId];
}

function personName(c: {
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
  email: string | null;
}): string | undefined {
  const full = [c.firstName, c.lastName].filter(Boolean).join(' ').trim();
  if (full) return full;
  return c.companyName ?? c.email ?? undefined;
}

// ─── crm: a saved report ─────────────────────────────────────────────────────
//
// Every report a teammate can open in the report builder, the seven ready-made
// ones included, and each found by exactly who can open it: one kept to its
// maker by her alone (`visible_to`, issue 264). A put-away report cannot be
// opened, so it leaves the index.

const reportProjector: EntityProjector = {
  entityType: 'report',
  module: 'crm',
  listIdsForTenant: (ctx: ProjectorContext) =>
    withTenant(ctx, async (tx) => {
      const rows = await tx.crmReport.findMany({
        where: { archivedAt: null },
        select: { id: true },
      });
      return rows.map((r) => r.id);
    }),
  project: (ctx: ProjectorContext, id: string) =>
    withTenant(ctx, async (tx): Promise<UniversalSearchDocument | null> => {
      const r = await tx.crmReport.findFirst({ where: { id, archivedAt: null } });
      if (!r) return null;
      const counts = await objectPlural(tx, r.objectKey);
      return {
        id: universalId(ctx.tenantId, 'report', r.id),
        tenant_id: ctx.tenantId,
        entity_type: 'report',
        module: 'crm',
        record_id: r.id,
        title: r.name,
        // What she wrote it for, else what it counts.
        subtitle: snippet(r.description, 120) ?? `A report on your ${counts.toLowerCase()}`,
        body: snippet(r.description),
        keywords: keywords([counts]),
        status: 'active',
        url: `/crm/report-builder/${r.id}`,
        created_at: epoch(r.createdAt),
        updated_at: epoch(r.updatedAt),
        visible_to: visibleTo(r),
      };
    }),
};

// ─── crm: a board of reports ─────────────────────────────────────────────────

const dashboardProjector: EntityProjector = {
  entityType: 'dashboard',
  module: 'crm',
  listIdsForTenant: (ctx: ProjectorContext) =>
    withTenant(ctx, async (tx) => {
      const rows = await tx.crmDashboard.findMany({
        where: { archivedAt: null },
        select: { id: true },
      });
      return rows.map((r) => r.id);
    }),
  project: (ctx: ProjectorContext, id: string) =>
    withTenant(ctx, async (tx): Promise<UniversalSearchDocument | null> => {
      const d = await tx.crmDashboard.findFirst({
        where: { id, archivedAt: null },
        include: {
          widgets: {
            where: { report: { archivedAt: null } },
            orderBy: [{ y: 'asc' }, { x: 'asc' }],
            select: {
              title: true,
              report: { select: { name: true, ownerId: true, shared: true } },
            },
          },
        },
      });
      if (!d) return null;
      // The reports on it are what a board is remembered by, after its name, in
      // the words its cards show. A put-away report is no longer on it. A card
      // for a private report adds its words only when everyone who can find the
      // board can see that report: a shared board holding its maker's private
      // card shows that card to nobody else, so search must not name it.
      const forEveryone = visibleTo(d)[0] === VISIBLE_TO_EVERYONE;
      const reports = d.widgets
        .filter(
          (w) =>
            ownerVisibility.canSee(null, w.report) ||
            (!forEveryone && w.report.ownerId === d.ownerId)
        )
        .map((w) => pickString(w.title) ?? w.report.name);
      const onIt = listWords(reports);
      return {
        id: universalId(ctx.tenantId, 'dashboard', d.id),
        tenant_id: ctx.tenantId,
        entity_type: 'dashboard',
        module: 'crm',
        record_id: d.id,
        title: d.name,
        subtitle:
          snippet(d.description, 120) ??
          (onIt ? `Shows ${onIt}` : d.isDefault ? 'The board you land on' : 'No reports on it yet'),
        body: snippet(d.description),
        keywords: keywords(reports),
        status: 'active',
        url: `/crm/dashboards/${d.id}`,
        created_at: epoch(d.createdAt),
        updated_at: epoch(d.updatedAt),
        visible_to: visibleTo(d),
      };
    }),
};

// ─── crm: a support request ──────────────────────────────────────────────────
//
// Found by its subject, its number (written either way, "42" or "#42"), or the
// customer who asked. A deleted request leaves the index; a closed one stays,
// because the queue keeps it in its history.

const ticketProjector: EntityProjector = {
  entityType: 'ticket',
  module: 'crm',
  listIdsForTenant: (ctx: ProjectorContext) =>
    withTenant(ctx, async (tx) => {
      const rows = await tx.ticket.findMany({ where: { deletedAt: null }, select: { id: true } });
      return rows.map((r) => r.id);
    }),
  project: (ctx: ProjectorContext, id: string) =>
    withTenant(ctx, async (tx): Promise<UniversalSearchDocument | null> => {
      const t = await tx.ticket.findFirst({
        where: { id, deletedAt: null },
        include: {
          customer: { select: { firstName: true, lastName: true, companyName: true, email: true } },
          company: { select: { companyName: true } },
          stage: { select: { name: true, stageType: true } },
        },
      });
      if (!t) return null;
      const who = t.company?.companyName ?? (t.customer ? personName(t.customer) : undefined);
      const number = `#${String(t.number)}`;
      return {
        id: universalId(ctx.tenantId, 'ticket', t.id),
        tenant_id: ctx.tenantId,
        entity_type: 'ticket',
        module: 'crm',
        record_id: t.id,
        title: t.subject,
        subtitle: who ? `${number} from ${who}` : `${number}, ${t.stage.name}`,
        body: snippet(t.description),
        keywords: keywords([
          number,
          String(t.number),
          who,
          t.customer?.email,
          t.stage.name,
          ...t.tags,
        ]),
        status: t.stage.stageType,
        url: `/crm/requests/${t.id}`,
        created_at: epoch(t.createdAt),
        updated_at: epoch(t.updatedAt),
      };
    }),
};

// ─── crm: a record type ──────────────────────────────────────────────────────
//
// Addressed by its KEY, not its row id: the screen is `/crm/record-types/:key`,
// and the key never changes once made. So the search entry is keyed by it too,
// and the `crm.object_def.*` events, which carry `objectKey`, signal it directly.
// The four built-ins are indexed as well: an owner who renamed "Customers" to
// "Patients" looks for the name she gave it.

const objectTypeProjector: EntityProjector = {
  entityType: 'crm_object_type',
  module: 'crm',
  listIdsForTenant: (ctx: ProjectorContext) =>
    withTenant(ctx, async (tx) => {
      const rows = await tx.crmObjectDef.findMany({ select: { key: true } });
      return rows.map((r) => r.key);
    }),
  project: (ctx: ProjectorContext, key: string) =>
    withTenant(ctx, async (tx): Promise<UniversalSearchDocument | null> => {
      const def = await tx.crmObjectDef.findFirst({ where: { key } });
      if (!def) return null;
      return {
        id: universalId(ctx.tenantId, 'crm_object_type', def.key),
        tenant_id: ctx.tenantId,
        entity_type: 'crm_object_type',
        module: 'crm',
        record_id: def.key,
        title: def.labelPlural,
        subtitle:
          snippet(def.description, 120) ??
          (def.kind === 'builtin' ? 'Comes with your account' : 'A kind of record you added'),
        body: snippet(def.description),
        keywords: keywords([def.label]),
        status: def.archivedAt ? 'archived' : 'active',
        url: `/crm/record-types/${encodeURIComponent(def.key)}`,
        created_at: epoch(def.createdAt),
        updated_at: epoch(def.updatedAt),
      };
    }),
};

// ─── crm: one record of a type the owner made up ─────────────────────────────
//
// Titled by the record's own title (the type's main field, kept on the row),
// with the type's singular name under it so "Spring cohort" reads as a Course.
// The other words she typed into it are searchable too.

/** The short text values of a record's details, for matching. */
function recordWords(values: unknown): string[] {
  if (values === null || typeof values !== 'object' || Array.isArray(values)) return [];
  return Object.values(values as Record<string, unknown>)
    .map(pickString)
    .filter((v): v is string => v !== undefined && v.length <= 200);
}

const crmRecordProjector: EntityProjector = {
  entityType: 'crm_record',
  module: 'crm',
  listIdsForTenant: (ctx: ProjectorContext) =>
    withTenant(ctx, async (tx) => {
      const rows = await tx.crmRecord.findMany({
        where: { deletedAt: null },
        select: { id: true },
      });
      return rows.map((r) => r.id);
    }),
  project: (ctx: ProjectorContext, id: string) =>
    withTenant(ctx, async (tx): Promise<UniversalSearchDocument | null> => {
      const r = await tx.crmRecord.findFirst({
        where: { id, deletedAt: null },
        include: { objectDef: { select: { label: true } } },
      });
      if (!r) return null;
      const words = recordWords(r.values);
      return {
        id: universalId(ctx.tenantId, 'crm_record', r.id),
        tenant_id: ctx.tenantId,
        entity_type: 'crm_record',
        module: 'crm',
        record_id: r.id,
        title: pickString(r.title) ?? `Untitled ${r.objectDef.label.toLowerCase()}`,
        subtitle: r.objectDef.label,
        body: snippet(words.join(' · ')),
        keywords: keywords(words.slice(0, 20)),
        status: 'active',
        // Two parameters: which type, and which record of it. The search box
        // reads this address to open it (`recordDestination`).
        url: `/crm/records/${encodeURIComponent(r.objectKey)}/${r.id}`,
        created_at: epoch(r.createdAt),
        updated_at: epoch(r.updatedAt),
      };
    }),
};

// ─── invoicing: a print template ─────────────────────────────────────────────

const billingTemplateProjector: EntityProjector = {
  entityType: 'billing_template',
  module: 'invoicing',
  listIdsForTenant: (ctx: ProjectorContext) =>
    withTenant(ctx, async (tx) => {
      const rows = await tx.billingDocumentTemplate.findMany({ select: { id: true } });
      return rows.map((r) => r.id);
    }),
  project: (ctx: ProjectorContext, id: string) =>
    withTenant(ctx, async (tx): Promise<UniversalSearchDocument | null> => {
      const t = await tx.billingDocumentTemplate.findFirst({ where: { id } });
      if (!t) return null;
      return {
        id: universalId(ctx.tenantId, 'billing_template', t.id),
        tenant_id: ctx.tenantId,
        entity_type: 'billing_template',
        module: 'invoicing',
        record_id: t.id,
        title: t.name,
        subtitle: t.isDefault
          ? 'What your documents print on unless you pick another'
          : t.publishedAt
            ? 'Ready to print on'
            : 'Not published yet',
        status: t.publishedAt ? 'published' : 'draft',
        url: `/invoicing/templates/${t.id}`,
        created_at: epoch(t.createdAt),
        updated_at: epoch(t.updatedAt),
      };
    }),
};

// ─── invoicing: a document workflow ──────────────────────────────────────────
//
// Read by its steps, because that is what tells two workflows apart: "Draft,
// Sent and Paid" against "Requested, Quoted and Accepted".

const documentWorkflowProjector: EntityProjector = {
  entityType: 'document_workflow',
  module: 'invoicing',
  listIdsForTenant: (ctx: ProjectorContext) =>
    withTenant(ctx, async (tx) => {
      const rows = await tx.documentWorkflow.findMany({ select: { id: true } });
      return rows.map((r) => r.id);
    }),
  project: (ctx: ProjectorContext, id: string) =>
    withTenant(ctx, async (tx): Promise<UniversalSearchDocument | null> => {
      const w = await tx.documentWorkflow.findFirst({
        where: { id },
        include: { stages: { select: { name: true }, orderBy: { sortOrder: 'asc' } } },
      });
      if (!w) return null;
      const steps = w.stages.map((s) => s.name);
      return {
        id: universalId(ctx.tenantId, 'document_workflow', w.id),
        tenant_id: ctx.tenantId,
        entity_type: 'document_workflow',
        module: 'invoicing',
        record_id: w.id,
        title: w.name,
        subtitle: listWords(steps, 4) ?? 'No steps yet',
        keywords: keywords([w.slug, ...steps]),
        status: w.archivedAt ? 'archived' : 'active',
        url: `/invoicing/workflows/${w.id}`,
        created_at: epoch(w.createdAt),
        updated_at: epoch(w.updatedAt),
      };
    }),
};

export const crmOwnerNamedProjectors: EntityProjector[] = [
  reportProjector,
  dashboardProjector,
  ticketProjector,
  objectTypeProjector,
  crmRecordProjector,
  billingTemplateProjector,
  documentWorkflowProjector,
];
