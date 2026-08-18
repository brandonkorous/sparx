// Deals — a sales pipeline, rebuilt from a file.
//
// Harder than it looks, because a deal cannot exist without a pipeline and a stage,
// and the export names both in the departing platform's vocabulary: "Decision Maker
// Bought-In", "Proposal Sent", "Qualified to Buy". None of those exist here.
//
// So the processor builds the pipeline as it reads the file — every stage name it
// meets that it has not seen becomes a real stage, appended in the order the rows
// arrive. That is the only approach that preserves what the tenant's process actually
// IS. Mapping their fourteen stages onto our five defaults would be us deciding how
// their sales team works, and the first thing they would notice is that their board
// no longer matches their week.
//
// Won and lost stages are typed as such, because forecast maths depends on it: a
// "Closed Won" column imported as an open stage makes every pipeline report wrong in
// a way that looks like a rounding error rather than a migration bug.

import { dealService, pipelineService } from '@wizeworks/crm';
import { toDecimal, toIsoDate, toInteger, toSlug } from '@wizeworks/migration';
import { withTenant } from '@wizeworks/db';

import { Resolver } from './resolve';
import {
  eachRow,
  type EntityProcessor,
  type ImportRow,
  type PreviewResult,
  type ProcessorContext,
  type RowResult,
} from './types';

type StageType = 'open' | 'won' | 'lost';

function stageTypeFor(row: ImportRow, stageName: string): StageType {
  const status = (row.status ?? '').trim().toLowerCase();
  if (status === 'won' || status === 'lost') return status;
  const name = stageName.toLowerCase();
  if (name.includes('won')) return 'won';
  if (name.includes('lost') || name.includes('closed - lost')) return 'lost';
  return 'open';
}

/** Resolves — and extends — the tenant's pipelines as the file is read. */
class PipelineBuilder {
  private pipelines = new Map<
    string,
    { id: string; stages: Map<string, string>; nextSort: number }
  >();
  private defaultKey: string | null = null;
  readonly createdStages: string[] = [];

  constructor(private readonly ctx: ProcessorContext) {}

  private key(value: string): string {
    return value.trim().toLowerCase();
  }

  async load(): Promise<void> {
    const { items } = await pipelineService.list(this.ctx, { objectKey: 'deal', take: 100 });
    for (const pipeline of items) {
      const stages = new Map<string, string>();
      let highest = 0;
      for (const stage of pipeline.stages) {
        stages.set(this.key(stage.name), stage.id);
        highest = Math.max(highest, stage.sortOrder + 1);
      }
      this.pipelines.set(this.key(pipeline.name), { id: pipeline.id, stages, nextSort: highest });
      if (pipeline.isDefault || this.defaultKey === null) this.defaultKey = this.key(pipeline.name);
    }
  }

  /** The pipeline named in the file, the tenant's default, or a newly created one. */
  private async pipelineFor(
    name: string
  ): Promise<{ id: string; stages: Map<string, string>; nextSort: number }> {
    const wanted = name.trim();
    if (wanted !== '') {
      const found = this.pipelines.get(this.key(wanted));
      if (found !== undefined) return found;
    }
    if (wanted === '' && this.defaultKey !== null) {
      const fallback = this.pipelines.get(this.defaultKey);
      if (fallback !== undefined) return fallback;
    }

    const label = wanted === '' ? 'Sales' : wanted;
    const created = await pipelineService.create(this.ctx, {
      name: label.slice(0, 120),
      slug: toSlug(label).slice(0, 60) || 'sales',
      objectKey: 'deal',
      isDefault: this.pipelines.size === 0,
    });
    const entry = { id: created.id, stages: new Map<string, string>(), nextSort: 0 };
    this.pipelines.set(this.key(label), entry);
    this.defaultKey ??= this.key(label);
    return entry;
  }

  async resolve(
    pipelineName: string,
    stageName: string,
    stageType: StageType
  ): Promise<{ pipelineId: string; stageId: string; createdStage: boolean }> {
    const pipeline = await this.pipelineFor(pipelineName);
    const label = stageName.trim() === '' ? 'Open' : stageName.trim();
    const existing = pipeline.stages.get(this.key(label));
    if (existing !== undefined) {
      return { pipelineId: pipeline.id, stageId: existing, createdStage: false };
    }

    const stage = await pipelineService.createStage(this.ctx, pipeline.id, {
      name: label.slice(0, 120),
      sortOrder: pipeline.nextSort,
      // A won stage is 100% by definition and a lost one 0%; anything else starts
      // neutral rather than pretending we know the tenant's conversion rates.
      probability: stageType === 'won' ? 100 : 0,
      stageType,
    });
    pipeline.stages.set(this.key(label), stage.id);
    pipeline.nextSort += 1;
    this.createdStages.push(label);
    return { pipelineId: pipeline.id, stageId: stage.id, createdStage: true };
  }
}

export const dealsProcessor: EntityProcessor = {
  entity: 'deals',
  module: 'crm',

  async run(ctx, rows, options, logger) {
    const builder = new PipelineBuilder(ctx);
    await builder.load();
    const resolver = new Resolver(ctx);

    return eachRow<RowResult>(
      rows,
      logger,
      async (row, rowIndex) => {
        const title = (row.name ?? '').trim();
        if (title === '')
          return { rowIndex, status: 'error', errorMsg: 'This row has no deal name.' };

        const stageName = (row.stage ?? '').trim();
        const stageType = stageTypeFor(row, stageName);
        const { pipelineId, stageId, createdStage } = await builder.resolve(
          row.pipeline ?? '',
          stageName,
          stageType
        );

        const existing = await withTenant(ctx, (tx) =>
          tx.deal.findFirst({
            where: { tenantId: ctx.tenantId, title: { equals: title, mode: 'insensitive' } },
            select: { id: true },
          })
        );
        if (existing !== null && !options.upsert) {
          return { rowIndex, status: 'skipped', naturalKey: title };
        }

        const companyId = await resolver.companyByName(row.company ?? '');
        const customerId = await resolver.customerByEmail(row.contact_email ?? '');
        const assignedRepId = await resolver.userByEmail(row.owner_email ?? '');
        const closeDate = toIsoDate(row.close_date);
        const probability = toInteger(row.probability);

        const input = {
          pipelineId,
          stageId,
          title: title.slice(0, 255),
          value: toDecimal(row.amount) ?? 0,
          ...(row.currency !== undefined && /^[A-Za-z]{3}$/.test(row.currency)
            ? { currency: row.currency.toUpperCase() }
            : {}),
          ...(probability !== undefined
            ? { probability: Math.min(Math.max(probability, 0), 100) }
            : {}),
          // `expectedCloseDate` is a plain date, and every export writes a timestamp.
          ...(closeDate !== undefined ? { expectedCloseDate: closeDate.slice(0, 10) } : {}),
          ...(companyId !== null ? { companyId } : {}),
          ...(customerId !== null ? { customerId } : {}),
          ...(assignedRepId !== null ? { assignedRepId } : {}),
          ...(row.source !== undefined && row.source !== ''
            ? { source: row.source.slice(0, 63) }
            : {}),
        };

        if (existing !== null) {
          await dealService.update(ctx, existing.id, input);
          return { rowIndex, status: 'updated', naturalKey: title };
        }

        await dealService.create(ctx, input);
        return {
          rowIndex,
          status: 'imported',
          naturalKey: title,
          ...(createdStage ? { errorMsg: `Added the stage “${stageName}” to your pipeline.` } : {}),
        };
      },
      (rowIndex, message) => ({ rowIndex, status: 'error', errorMsg: message })
    );
  },

  async preview(ctx, rows, logger) {
    const { items } = await pipelineService.list(ctx, { objectKey: 'deal', take: 100 });
    const knownStages = new Set<string>();
    for (const pipeline of items) {
      for (const stage of pipeline.stages) knownStages.add(stage.name.trim().toLowerCase());
    }

    return eachRow<PreviewResult>(
      rows,
      logger,
      async (row, rowIndex) => {
        const title = (row.name ?? '').trim();
        if (title === '') return { rowIndex, action: 'error', errorMsg: 'No deal name.' };

        const existing = await withTenant(ctx, (tx) =>
          tx.deal.findFirst({
            where: { tenantId: ctx.tenantId, title: { equals: title, mode: 'insensitive' } },
            select: { id: true },
          })
        );
        const stageName = (row.stage ?? '').trim();
        const newStage = stageName !== '' && !knownStages.has(stageName.toLowerCase());
        if (newStage) knownStages.add(stageName.toLowerCase());

        return {
          rowIndex,
          action: existing === null ? 'create' : 'update',
          naturalKey: title,
          ...(newStage ? { errorMsg: `Will add the stage “${stageName}”.` } : {}),
        };
      },
      (rowIndex, message) => ({ rowIndex, action: 'error', errorMsg: message })
    );
  },
};
