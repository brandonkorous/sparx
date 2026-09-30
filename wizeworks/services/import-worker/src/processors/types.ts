// The processor contract.
//
// Every entity an import can carry implements this, and `handler.ts` knows nothing
// beyond it. Before this existed the handler carried a copy-pasted result loop per
// entity — four of them, identical apart from one function call — which is why adding
// a fifth entity had never happened despite being asked for twice.

import type { Logger } from 'pino';

export interface ProcessorContext {
  tenantId: string;
  /** The operator who started the run, for audit attribution. */
  userId?: string;
  /** The site an import is scoped to. Content, redirects and media are site-scoped;
   *  products and customers are tenant-scoped. Null means the tenant's primary. */
  propertyId?: string | null;
  /** Slug, needed by the media service to build public URLs. */
  tenantSlug?: string;
}

export interface ProcessorOptions {
  /** Update a record that already matches the natural key. Off means skip it. */
  upsert: boolean;
  /** Which platform the rows came from, for provenance in notes and audit lines. */
  vendor?: string;
  /**
   * The modules the tenant had on when the job was created, as the API saw them.
   *
   * An entity's own module is gated before a job exists; this is for the writes an
   * entity makes into ANOTHER module's tables, such as the redirect a product's old
   * address becomes, which belongs to the site builder. Absent means the job did not
   * say, and a processor must not guess a module is on.
   */
  modules?: readonly string[];
  /**
   * True when the same move also carries a stock levels file. A product file's
   * quantity is then left alone: the per-location file is the real count, and
   * applying both would put the same stock on the shelf twice.
   */
  stockLevelsInRun?: boolean;
}

export interface RowResult {
  rowIndex: number;
  status: 'imported' | 'updated' | 'skipped' | 'error';
  naturalKey?: string;
  /**
   * The reason, for an error — and for a non-error row, a note about something that
   * was done differently than asked (an image that had to be linked rather than
   * copied, a warehouse that had to be created). Surfaced in the run report either
   * way, because "it worked, but" is information a tenant needs and has nowhere else
   * to learn.
   */
  errorMsg?: string;
}

/** What a row WOULD do, worked out without writing anything. */
export interface PreviewResult {
  rowIndex: number;
  action: 'create' | 'update' | 'skip' | 'error';
  naturalKey?: string;
  errorMsg?: string;
}

export type ImportRow = Record<string, string | undefined>;

export interface EntityProcessor {
  /** Matches `ImportJob.entityType`. */
  entity: string;
  /** Module that must be enabled, or null for one that is always available. */
  module: string | null;
  run(
    ctx: ProcessorContext,
    rows: ImportRow[],
    options: ProcessorOptions,
    logger: Logger
  ): Promise<RowResult[]>;
  /**
   * Read-only. Resolves each row's natural key against the tenant's real data and
   * reports create/update/skip/error WITHOUT writing.
   *
   * Deliberately a separate function rather than a `dryRun` flag threaded through
   * `run`: the services this worker calls own their own transactions, so there is no
   * outer transaction to roll back and a flag would be a promise we cannot keep. A
   * preview that quietly wrote one row would be worse than no preview at all.
   */
  preview(ctx: ProcessorContext, rows: ImportRow[], logger: Logger): Promise<PreviewResult[]>;
}

/** Wrap a row-at-a-time function so one bad row never costs the rest of the file. */
export async function eachRow<T extends { rowIndex: number }>(
  rows: ImportRow[],
  logger: Logger,
  handle: (row: ImportRow, index: number) => Promise<T>,
  onError: (index: number, message: string) => T
): Promise<T[]> {
  const results: T[] = [];
  for (let index = 0; index < rows.length; index++) {
    try {
      results.push(await handle(rows[index]!, index));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn({ err: error, rowIndex: index }, 'row failed');
      results.push(onError(index, message));
    }
  }
  return results;
}
