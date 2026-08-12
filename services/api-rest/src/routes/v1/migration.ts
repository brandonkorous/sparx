// Migration routes — moving a business off another platform.
//
//   GET  /v1/migration/vendors            the catalogue, with this tenant's modules applied
//   POST /v1/migration/connect            check a live connection's credentials
//   POST /v1/migration/pull               one page of rows from a live connection
//   POST /v1/migration/runs               start a run: N chunked import jobs under one id
//   GET  /v1/migration/runs               past runs, newest first
//   GET  /v1/migration/runs/:runId        one run: per-entity rollup + failed rows
//   POST /v1/migration/runs/:runId/cancel stop anything that has not started yet
//
// A "run" has no table of its own. It is a set of `ImportJob` rows sharing an
// `options.migrationRunId`, which is enough to group, report on and cancel them — and
// which keeps this whole feature off the migration pipeline (see packages/db/CLAUDE.md
// for why adding a table is never free here).
//
// Rows arrive already mapped to canonical shape and already validated in the browser
// by `@sparx/migration`. This layer re-checks rather than trusts: the same validator
// runs again server-side, because "the client checked it" is not a security model and
// the API is a public surface in its own right.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import {
  CANONICAL_ENTITIES,
  ConnectorError,
  ENTITY_LABEL,
  ENTITY_MODULE,
  availableResources,
  catalogue,
  connectorDescriptorForVendor,
  connectorForVendor,
  validateRows,
  type CanonicalEntity,
  type EntityModule,
} from '@sparx/migration';
import { guardedFetch } from '../../lib/guarded-fetch.js';
import { isModuleEnabled } from '@sparx/auth';
import { withRequestTenant } from '@sparx/api-core/db';
import { ok } from '@sparx/api-core/envelope';
import { requireAuth, requireRole } from '@sparx/api-core/auth';
import { publish } from '@sparx/api-core/pubsub';
import { badRequest, notFound } from '@sparx/api-core/errors';

/** One import job's worth of rows. Chunked by the client so a 40,000-row catalogue
 *  does not become one JSONB blob the size of a novel. */
const MAX_ROWS_PER_JOB = 5_000;
/** Total across one run. Past this a tenant needs the live connector, not a file. */
const MAX_ROWS_PER_RUN = 200_000;

const EntityEnum = z.enum(CANONICAL_ENTITIES as unknown as [string, ...string[]]);

const RunEntity = z.object({
  entity: EntityEnum,
  rows: z.array(z.record(z.string(), z.string())).min(1).max(MAX_ROWS_PER_RUN),
});

const CreateRunBody = z.object({
  /** Vendor slug, for provenance on every row this run writes. */
  vendor: z.string().max(64).optional(),
  /** The vendor's own file name, so the run reads back the way the tenant remembers it. */
  fileName: z.string().max(255).optional(),
  /** The site being migrated. Content, redirects and orders are scoped to it. */
  propertyId: z.string().uuid().nullable().optional(),
  /** Update records that already match, rather than skipping them. */
  upsert: z.boolean().optional(),
  /** Resolve and report without writing anything. */
  dryRun: z.boolean().optional(),
  entities: z.array(RunEntity).min(1).max(20),
});

const PreviewBody = z.object({
  entity: EntityEnum,
  rows: z.array(z.record(z.string(), z.string())).min(1).max(MAX_ROWS_PER_JOB),
});

const PathRunId = z.object({ runId: z.string().min(1).max(64) });

/**
 * Live-connection credentials.
 *
 * Free-form because each connector declares its own fields, and capped hard because
 * this is a bag of strings arriving from outside — an access token is a hundred
 * characters, not a hundred thousand.
 */
const ConnectorCredentials = z.record(z.string().max(64), z.string().max(2_048));

const ConnectBody = z.object({
  vendor: z.string().min(1).max(64),
  credentials: ConnectorCredentials,
});

const PullBody = z.object({
  vendor: z.string().min(1).max(64),
  entity: EntityEnum,
  cursor: z.string().max(4_096).nullable().optional(),
  credentials: ConnectorCredentials,
});

/**
 * The order entities MUST be imported in.
 *
 * Not cosmetic — every one of these is a dependency. Stock levels resolve a SKU that
 * products create. Collections list products. Orders attach to customers. Segments
 * list customers. A run that imports them in file order half-works and looks like the
 * importer is broken, when in fact it was simply asked to hang a coat before the hook
 * existed.
 */
const ENTITY_ORDER: CanonicalEntity[] = [
  'categories',
  'products',
  'collections',
  'inventory_levels',
  'suppliers',
  'purchase_orders',
  'discounts',
  'companies',
  'customers',
  'b2b_accounts',
  'segments',
  'deals',
  'tickets',
  'orders',
  'media',
  'content',
  'redirects',
];

function orderOf(entity: string): number {
  const index = ENTITY_ORDER.indexOf(entity as CanonicalEntity);
  return index === -1 ? ENTITY_ORDER.length : index;
}

/**
 * Run something against somebody else's API and turn its failure into ours.
 *
 * A `ConnectorError` already carries a sentence written for a business owner plus the
 * hint that tells them where to click — losing either to a generic 500 would waste the
 * only part of that failure that is any use. Everything else is left to the error
 * handler, because an unexpected throw here IS a 500 and should look like one.
 */
async function connectorPromise<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (!(error instanceof ConnectorError)) throw error;
    const message = error.hint === undefined ? error.message : `${error.message} ${error.hint}`;
    throw badRequest(message, { hint: error.hint ?? null, retryable: error.retryable });
  }
}

interface JobSummary {
  id: string;
  entityType: string;
  status: string;
  rowCount: number;
  importedCount: number;
  updatedCount: number;
  errorCount: number;
  completedAt: string | null;
}

// eslint-disable-next-line @typescript-eslint/require-await
const migrationRoutes: FastifyPluginAsync = async (app) => {
  // ──────────────────────────────────────────────────────────────────────
  // GET /v1/migration/vendors
  //
  // The catalogue, with each vendor's entities marked available or locked for
  // THIS tenant. A locked entity is reported with the module that would unlock
  // it rather than hidden: "your posts will come across when you turn the
  // website builder on" is useful; a silently shorter list is not.
  // ──────────────────────────────────────────────────────────────────────
  app.get('/v1/migration/vendors', async (request) => {
    const auth = requireAuth(request);

    const required = new Set(
      Object.values(ENTITY_MODULE).filter((module): module is EntityModule => module !== null)
    );
    const modules = new Map<EntityModule, boolean>();
    for (const module of required) {
      modules.set(module, await isModuleEnabled(auth.tenantId, module));
    }

    const vendors = catalogue().map((vendor) => ({
      ...vendor,
      entities: vendor.entities.map((entity) => {
        const module = ENTITY_MODULE[entity];
        return {
          entity,
          label: ENTITY_LABEL[entity].many,
          module,
          available: module === null || modules.get(module) === true,
        };
      }),
      // The credential form is rendered from this rather than written twice — adding
      // a field to a connector should not mean editing a form component as well.
      connector: connectorDescriptorForVendor(vendor.slug) ?? null,
    }));

    return ok({ vendors });
  });

  // ──────────────────────────────────────────────────────────────────────
  // POST /v1/migration/connect
  //
  // One cheap call proving the credentials work, before the tenant is asked
  // to choose anything. It answers the question they are actually nervous
  // about — "did that work, and is it MY account you found" — which is why
  // the reply names the account rather than saying OK.
  //
  // Nothing is stored. The credentials live in the request and are gone when
  // it ends; the browser holds them for the duration of the move and then
  // forgets them too. A migration is a one-off, and keeping a key to a
  // platform somebody has just left is a liability with no upside.
  // ──────────────────────────────────────────────────────────────────────
  app.post('/v1/migration/connect', async (request) => {
    const auth = requireRole(request, 'editor');
    const input = ConnectBody.parse(request.body);

    const connector = connectorForVendor(input.vendor);
    if (connector === undefined) {
      throw badRequest(
        `${input.vendor} has no live connection — bring your files across instead, which works the same way from the second step on.`
      );
    }

    const account = await connectorPromise(() =>
      connector.verify({ credentials: input.credentials, fetch: guardedFetch() })
    );

    // Resources the credentials reach, minus anything whose module is off. Both
    // reasons are reported rather than filtered away: "add your shop keys" and
    // "switch the blog on" are different problems with different fixes.
    const reachable = availableResources(connector, input.credentials);
    const resources = [];
    for (const resource of reachable) {
      const module = ENTITY_MODULE[resource.entity];
      resources.push({
        ...resource,
        module,
        available: module === null || (await isModuleEnabled(auth.tenantId, module)),
      });
    }

    const withheld = connector.resources
      .filter((resource) => !reachable.includes(resource))
      .map((resource) => ({
        entity: resource.entity,
        label: resource.label,
        needs: resource.requires ?? '',
      }));

    return ok({ vendor: input.vendor, account, resources, withheld });
  });

  // ──────────────────────────────────────────────────────────────────────
  // POST /v1/migration/pull
  //
  // One page of rows from the live connection, in exactly the canonical shape
  // a parsed file produces.
  //
  // This deliberately RETURNS the rows rather than writing them. A live
  // connection is a different way of getting the data in front of the tenant,
  // not a different way of importing it — so the pages go back to the browser,
  // get checked by the same validator, and go through the same practice run
  // and the same confirmation as a dropped file. A connector that wrote
  // straight to the database would be a second, unreviewed path into an
  // account, and the "nothing is saved until you have seen it" promise would
  // hold for files and quietly not for this.
  // ──────────────────────────────────────────────────────────────────────
  app.post('/v1/migration/pull', async (request) => {
    const auth = requireRole(request, 'editor');
    const input = PullBody.parse(request.body);

    const connector = connectorForVendor(input.vendor);
    if (connector === undefined) {
      throw badRequest(`${input.vendor} has no live connection.`);
    }

    const entity = input.entity as CanonicalEntity;
    if (!connector.resources.some((resource) => resource.entity === entity)) {
      throw badRequest(
        `We do not read ${ENTITY_LABEL[entity].many.toLowerCase()} from ${connector.label}.`
      );
    }

    const module = ENTITY_MODULE[entity];
    if (module !== null && !(await isModuleEnabled(auth.tenantId, module))) {
      throw badRequest(
        `${ENTITY_LABEL[entity].many} need the ${module} module switched on before they can come across.`
      );
    }

    const page = await connectorPromise(() =>
      connector.pull({
        credentials: input.credentials,
        entity,
        cursor: input.cursor ?? null,
        fetch: guardedFetch(),
      })
    );

    return ok(page);
  });

  // ──────────────────────────────────────────────────────────────────────
  // POST /v1/migration/preview
  //
  // Server-side validation of one entity's rows. The browser has already run
  // the same check; this is the copy that counts, and it is also what a
  // non-browser client (a script, the MCP server) gets.
  // ──────────────────────────────────────────────────────────────────────
  // Not async, and that is the point: validation is pure and synchronous — the
  // same code the browser already ran, with nothing to wait for.
  app.post('/v1/migration/preview', (request) => {
    requireRole(request, 'editor');
    const input = PreviewBody.parse(request.body);
    const report = validateRows(input.entity as CanonicalEntity, input.rows);
    return ok({ report });
  });

  // ──────────────────────────────────────────────────────────────────────
  // POST /v1/migration/runs
  // ──────────────────────────────────────────────────────────────────────
  app.post('/v1/migration/runs', async (request, reply) => {
    const auth = requireRole(request, 'editor');
    const input = CreateRunBody.parse(request.body);

    const totalRows = input.entities.reduce((sum, entity) => sum + entity.rows.length, 0);
    if (totalRows > MAX_ROWS_PER_RUN) {
      throw badRequest(
        `That is ${totalRows.toLocaleString()} rows in one go; the limit is ${MAX_ROWS_PER_RUN.toLocaleString()}. Split the file, or use a live connection instead.`
      );
    }

    // Module gate. An entity whose module is off is REPORTED and skipped, never
    // an error on the whole run — a WordPress export carrying products for a
    // tenant who only wants the blog should import the blog.
    const skipped: { entity: string; module: string; rows: number }[] = [];
    const accepted: { entity: CanonicalEntity; rows: Record<string, string>[] }[] = [];
    for (const entry of input.entities) {
      const entity = entry.entity as CanonicalEntity;
      const module = ENTITY_MODULE[entity];
      if (module !== null && !(await isModuleEnabled(auth.tenantId, module))) {
        skipped.push({ entity, module, rows: entry.rows.length });
        continue;
      }
      accepted.push({ entity, rows: entry.rows });
    }

    if (accepted.length === 0) {
      throw badRequest(
        `Nothing in this file can be imported yet — it carries ${skipped
          .map((s) => ENTITY_LABEL[s.entity as CanonicalEntity].many.toLowerCase())
          .join(' and ')}, and the modules for those are turned off.`
      );
    }

    // Validate server-side. Rows that would fail are dropped here rather than
    // becoming error rows later, so the counts the tenant is shown are the counts
    // that will actually happen.
    const runId = randomUUID();
    const created: JobSummary[] = [];
    const reports: Record<string, ReturnType<typeof validateRows>> = {};

    // Ordered so dependencies land first — see ENTITY_ORDER.
    accepted.sort((a, b) => orderOf(a.entity) - orderOf(b.entity));

    let sequence = 0;
    for (const entry of accepted) {
      const report = validateRows(entry.entity, entry.rows);
      reports[entry.entity] = report;
      if (report.blocked) continue;

      const failing = new Set(report.errorRows);
      const rows = entry.rows.filter((_row, index) => !failing.has(index));
      if (rows.length === 0) continue;

      for (let start = 0; start < rows.length; start += MAX_ROWS_PER_JOB) {
        const chunk = rows.slice(start, start + MAX_ROWS_PER_JOB);
        const job = await withRequestTenant(request, (tx) =>
          tx.importJob.create({
            data: {
              tenantId: auth.tenantId,
              entityType: entry.entity,
              status: 'pending',
              fileName: input.fileName ?? null,
              rowCount: chunk.length,
              options: {
                migrationRunId: runId,
                // Sequence is what makes the run replayable and readable in order;
                // job ids are uuids and sort by nothing useful.
                sequence: sequence++,
                upsert: input.upsert !== false,
                dryRun: input.dryRun === true,
                ...(input.vendor === undefined ? {} : { vendor: input.vendor }),
                ...(input.propertyId === undefined ? {} : { propertyId: input.propertyId }),
              },
              rawRows: chunk,
              actorId: auth.actorId ?? null,
            },
            select: {
              id: true,
              entityType: true,
              status: true,
              rowCount: true,
              importedCount: true,
              updatedCount: true,
              errorCount: true,
              completedAt: true,
            },
          })
        );

        await publish(request.log, 'import.job.created', auth.tenantId, auth.actorId ?? null, {
          jobId: job.id,
          entityType: job.entityType,
        });

        created.push({
          ...job,
          completedAt: job.completedAt?.toISOString() ?? null,
        });
      }
    }

    if (created.length === 0) {
      throw badRequest(
        'Nothing in this file can be imported as it stands — every row has a problem that has to be fixed first.'
      );
    }

    return reply.code(202).send(
      ok({
        runId,
        vendor: input.vendor ?? null,
        dryRun: input.dryRun === true,
        jobs: created,
        skipped,
        reports,
      })
    );
  });

  // ──────────────────────────────────────────────────────────────────────
  // GET /v1/migration/runs
  // ──────────────────────────────────────────────────────────────────────
  app.get('/v1/migration/runs', async (request) => {
    requireRole(request, 'viewer');

    // Jobs that belong to a migration, newest first. Ordinary one-off imports
    // (the older /v1/commerce/products/import path) carry no run id and are not
    // listed here — they belong to the surface that created them.
    //
    // The filter is `string_contains: '-'` and not the obvious "this path is not
    // null", because Prisma has no key-exists operator for JSON: a `path` may only
    // be paired with a SCALAR filter, and pairing it with `not: undefined` — which
    // reads like "present" — compiles fine and then fails at the database with
    // "A JSON path cannot be set without a scalar filter". A run id is a uuid, so
    // every one of them contains a hyphen and nothing without the key can match.
    const jobs = await withRequestTenant(request, (tx) =>
      tx.importJob.findMany({
        where: { options: { path: ['migrationRunId'], string_contains: '-' } },
        orderBy: { createdAt: 'desc' },
        take: 500,
        select: {
          id: true,
          entityType: true,
          status: true,
          fileName: true,
          rowCount: true,
          importedCount: true,
          updatedCount: true,
          errorCount: true,
          options: true,
          createdAt: true,
          completedAt: true,
        },
      })
    );

    const byRun = new Map<
      string,
      {
        runId: string;
        vendor: string | null;
        fileName: string | null;
        dryRun: boolean;
        startedAt: string;
        status: string;
        rowCount: number;
        importedCount: number;
        updatedCount: number;
        errorCount: number;
        entities: string[];
      }
    >();

    for (const job of jobs) {
      const options = (job.options ?? {}) as {
        migrationRunId?: string;
        vendor?: string;
        dryRun?: boolean;
      };
      const runId = options.migrationRunId;
      if (runId === undefined) continue;

      const existing = byRun.get(runId);
      if (existing === undefined) {
        byRun.set(runId, {
          runId,
          vendor: options.vendor ?? null,
          fileName: job.fileName,
          dryRun: options.dryRun === true,
          startedAt: job.createdAt.toISOString(),
          status: job.status,
          rowCount: job.rowCount,
          importedCount: job.importedCount,
          updatedCount: job.updatedCount,
          errorCount: job.errorCount,
          entities: [job.entityType],
        });
        continue;
      }

      existing.rowCount += job.rowCount;
      existing.importedCount += job.importedCount;
      existing.updatedCount += job.updatedCount;
      existing.errorCount += job.errorCount;
      if (!existing.entities.includes(job.entityType)) existing.entities.push(job.entityType);
      // A run is only finished when every one of its jobs is. Anything still
      // pending or processing makes the whole run "running".
      if (job.status === 'pending' || job.status === 'processing') existing.status = 'running';
      else if (job.status === 'failed' && existing.status !== 'running') existing.status = 'failed';
    }

    return ok({ runs: [...byRun.values()] });
  });

  // ──────────────────────────────────────────────────────────────────────
  // GET /v1/migration/runs/:runId
  // ──────────────────────────────────────────────────────────────────────
  app.get('/v1/migration/runs/:runId', async (request) => {
    requireRole(request, 'viewer');
    const { runId } = PathRunId.parse(request.params);

    const jobs = await withRequestTenant(request, (tx) =>
      tx.importJob.findMany({
        where: { options: { path: ['migrationRunId'], equals: runId } },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          entityType: true,
          status: true,
          fileName: true,
          rowCount: true,
          importedCount: true,
          updatedCount: true,
          errorCount: true,
          options: true,
          createdAt: true,
          completedAt: true,
        },
      })
    );

    if (jobs.length === 0) throw notFound('Migration run', runId);

    // Only the rows that need a person: errors, and the notes a successful row
    // left behind ("this image had to be linked", "this location was created").
    const problems = await withRequestTenant(request, (tx) =>
      tx.importJobRow.findMany({
        where: { jobId: { in: jobs.map((job) => job.id) }, errorMsg: { not: null } },
        orderBy: [{ jobId: 'asc' }, { rowIndex: 'asc' }],
        take: 1000,
        select: { jobId: true, rowIndex: true, status: true, naturalKey: true, errorMsg: true },
      })
    );

    const entityByJob = new Map(jobs.map((job) => [job.id, job.entityType]));
    const firstOptions = (jobs[0]?.options ?? {}) as {
      vendor?: string;
      dryRun?: boolean;
      propertyId?: string | null;
    };

    const byEntity = new Map<
      string,
      {
        entity: string;
        rowCount: number;
        imported: number;
        updated: number;
        errors: number;
        done: boolean;
      }
    >();
    for (const job of jobs) {
      const existing = byEntity.get(job.entityType) ?? {
        entity: job.entityType,
        rowCount: 0,
        imported: 0,
        updated: 0,
        errors: 0,
        done: true,
      };
      existing.rowCount += job.rowCount;
      existing.imported += job.importedCount;
      existing.updated += job.updatedCount;
      existing.errors += job.errorCount;
      if (job.status === 'pending' || job.status === 'processing') existing.done = false;
      byEntity.set(job.entityType, existing);
    }

    const running = jobs.some((job) => job.status === 'pending' || job.status === 'processing');
    const failed = jobs.some((job) => job.status === 'failed');

    return ok({
      run: {
        runId,
        vendor: firstOptions.vendor ?? null,
        dryRun: firstOptions.dryRun === true,
        propertyId: firstOptions.propertyId ?? null,
        fileName: jobs[0]?.fileName ?? null,
        startedAt: jobs[0]?.createdAt.toISOString() ?? null,
        status: running ? 'running' : failed ? 'failed' : 'completed',
        entities: [...byEntity.values()],
      },
      jobs: jobs.map((job) => ({
        id: job.id,
        entityType: job.entityType,
        status: job.status,
        rowCount: job.rowCount,
        importedCount: job.importedCount,
        updatedCount: job.updatedCount,
        errorCount: job.errorCount,
        completedAt: job.completedAt?.toISOString() ?? null,
      })),
      problems: problems.map((row) => ({
        entity: entityByJob.get(row.jobId) ?? 'unknown',
        rowIndex: row.rowIndex,
        status: row.status,
        naturalKey: row.naturalKey,
        message: row.errorMsg,
      })),
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // POST /v1/migration/runs/:runId/cancel
  //
  // Cancels what has not started. A job already running is left alone rather
  // than half-killed — stopping a processor mid-file would leave the tenant with
  // an unknown fraction of their catalogue and no record of which fraction.
  // ──────────────────────────────────────────────────────────────────────
  app.post('/v1/migration/runs/:runId/cancel', async (request) => {
    requireRole(request, 'editor');
    const { runId } = PathRunId.parse(request.params);

    const result = await withRequestTenant(request, (tx) =>
      tx.importJob.updateMany({
        where: {
          options: { path: ['migrationRunId'], equals: runId },
          status: 'pending',
        },
        data: { status: 'failed', completedAt: new Date() },
      })
    );

    return ok({
      runId,
      cancelled: result.count,
      note:
        result.count === 0
          ? 'Nothing left to cancel — every part of this migration had already started.'
          : `${result.count} part${result.count === 1 ? '' : 's'} of this migration were stopped before they began. Anything already running was left to finish.`,
    });
  });
};

export default migrationRoutes;
