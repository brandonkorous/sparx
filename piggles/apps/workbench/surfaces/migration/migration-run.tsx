'use client';

// MOVE IN — the errand, held in one pane so the file is never lost between steps.
//
// Pick a source (./migration-pick-source) → see what is in it, checked in this
// browser with nothing uploaded (./migration-staged, ./migration-file-report) →
// import → watch it land (./migration-progress). That ORDER is the whole design:
// importers people abandon ask for the upload first and report the damage after.
//
// A live pull takes the same road as a file from step two on, because the
// connector returns the same canonical rows the parser does and there is only one
// validator.

import { useCallback, useMemo, useState } from 'react';
import { Button, useToast } from '@wizeworks/silicaui-react';
import { faPlay, faRotate, faUpload } from '@fortawesome/pro-solid-svg-icons';

import { Icon } from '@piggles/ui';
import type { MappedEntity } from '@wizeworks/migration';
import { RunProgress } from './migration-progress';
import { PickSource } from './migration-pick-source';
import { StagedSource } from './migration-staged';
import { LiveConnection, type LivePull } from './live-connection';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import {
  entityLabel,
  loadFile,
  useMigrationVendors,
  useStartMigration,
  type LoadedFile,
} from './data';

const COLUMN = 'mx-auto flex w-full max-w-4xl flex-col gap-4 overflow-y-auto';

export function MigrationRunSurface({ ctx }: { ctx: SurfaceContext }) {
  const toast = useToast();
  const vendorParam = typeof ctx.params.vendor === 'string' ? ctx.params.vendor : undefined;
  const runParam = typeof ctx.params.runId === 'string' ? ctx.params.runId : null;

  const [loaded, setLoaded] = useState<LoadedFile | null>(null);
  /** The result of hand-mapping an unrecognised file. Null until it is usable. */
  const [manual, setManual] = useState<MappedEntity | null>(null);
  /** Rows pulled from a live connection, already validated by the same code a file
   *  goes through. Mutually exclusive with `loaded` — one errand, one source. */
  const [live, setLive] = useState<LivePull | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(runParam);
  const [reading, setReading] = useState(false);

  const start = useStartMigration();
  const { data: catalogue } = useMigrationVendors();
  const vendor = useMemo(
    () => (catalogue?.vendors ?? []).find((entry) => entry.slug === vendorParam),
    [catalogue, vendorParam]
  );

  const onFile = useCallback(async (file: File) => {
    setReading(true);
    setReadError(null);
    try {
      const result = await loadFile(file);
      setLoaded(result);
      // A new file invalidates any mapping built for the last one.
      setManual(null);
    } catch (error) {
      setLoaded(null);
      setManual(null);
      setReadError(error instanceof Error ? error.message : 'We could not read that file.');
    } finally {
      setReading(false);
    }
  }, []);

  // A recognised file brings its own entities; an unrecognised one brings whatever
  // the tenant mapped by hand. Both arrive here in the same shape, so everything
  // downstream — the count, the practice run, the import — is identical either way.
  const importable = useMemo(() => {
    const usable = (entities: MappedEntity[]): MappedEntity[] =>
      entities.filter((entity) => !entity.report.blocked && entity.report.okCount > 0);

    if (live !== null) return usable(live.entities);
    if (loaded === null) return [];
    // Same test the report above renders on. When we are only guessing, the screen
    // shows the mapper, so the tenant's own mapping is what gets imported — reading
    // the guessed vendor's entities here would import a different set of columns
    // from the one she is looking at.
    if (loaded.result.detected === null || !loaded.result.sure) {
      return manual === null || manual.report.blocked || manual.report.okCount === 0
        ? []
        : [manual];
    }
    return usable(loaded.result.entities);
  }, [live, loaded, manual]);

  const totalReady = importable.reduce((sum, entity) => sum + entity.report.okCount, 0);

  const begin = useCallback(
    async (dryRun: boolean) => {
      if (importable.length === 0) return;
      // What the run reads back as later. A file is remembered by its name; a live
      // connection by whose account it was, which is the equivalent fact.
      const from =
        live !== null
          ? `Live connection · ${live.account}`
          : loaded === null
            ? undefined
            : loaded.name;
      // Only a vendor we are SURE of goes on the record. "Past moves" is read back
      // months later as a statement of where a business came from, and a coin toss
      // filed as fact there is a coin toss nobody can spot afterwards.
      const detectedVendor =
        loaded?.result.sure === true ? loaded.result.detected?.vendorSlug : undefined;

      try {
        const result = await start.mutateAsync({
          ...(vendorParam === undefined
            ? detectedVendor === undefined
              ? {}
              : { vendor: detectedVendor }
            : { vendor: vendorParam }),
          ...(from === undefined ? {} : { fileName: from }),
          dryRun,
          entities: importable.map((entity) => ({
            entity: entity.entity,
            // Only the rows that passed. The tenant was shown this count; sending
            // rows we already know will fail would make that count a lie.
            rows: entity.rows.filter((_row, index) => !entity.report.errorRows.includes(index)),
          })),
        });
        setRunId(result.runId);
        ctx.setTitle(dryRun ? 'Practice run' : 'Moving in');
        if (result.skipped.length > 0) {
          toast.add({
            title: 'Some of this file was left out',
            description: result.skipped
              .map(
                (skip) =>
                  `${entityLabel(skip.entity, skip.rows)} — the ${skip.module} module is switched off.`
              )
              .join(' '),
            type: 'info',
          });
        }
      } catch (error) {
        toast.add({
          title: 'That did not start',
          description: error instanceof Error ? error.message : 'Try again in a moment.',
          type: 'error',
        });
      }
    },
    [live, loaded, importable, start, vendorParam, ctx, toast]
  );

  const reset = useCallback(() => {
    setLoaded(null);
    setManual(null);
    setLive(null);
    setConnecting(false);
    setRunId(null);
    setReadError(null);
    // Otherwise an empty file-drop keeps the last run's title — "Practice run" — and
    // the saved layout brings it back next visit. The file input clears itself.
    ctx.setTitle('Move in');
  }, [ctx]);

  /** True once there is something to look at, from either source. */
  const staged = loaded !== null || live !== null;

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar
        label="Migration run controls"
        controls={
          <>
            {runId !== null ? (
              <Button variant="ghost" size="sm" onClick={reset}>
                <Icon glyph={faRotate} className="size-4" aria-hidden />
                Move something else
              </Button>
            ) : null}
            {staged && runId === null ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={importable.length === 0 || start.isPending}
                  onClick={() => void begin(true)}
                >
                  <Icon glyph={faPlay} className="size-4" aria-hidden />
                  Practice run
                </Button>
                <Button
                  color="primary"
                  size="sm"
                  disabled={importable.length === 0 || start.isPending}
                  onClick={() => void begin(false)}
                >
                  <Icon glyph={faUpload} className="size-4" aria-hidden />
                  Bring in {totalReady.toLocaleString()}
                </Button>
              </>
            ) : null}
          </>
        }
      />

      <div className={COLUMN}>
        {runId !== null ? (
          <RunProgress runId={runId} />
        ) : connecting ? (
          vendor === undefined ? null : (
            <LiveConnection
              vendor={vendor}
              onReady={(pull) => {
                setLive(pull);
                setConnecting(false);
                ctx.setTitle(`Moving from ${vendor.name}`);
              }}
              onCancel={() => {
                setConnecting(false);
              }}
            />
          )
        ) : !staged ? (
          <PickSource
            vendor={vendor}
            reading={reading}
            readError={readError}
            onFile={(file) => void onFile(file)}
            onConnect={() => {
              setConnecting(true);
            }}
          />
        ) : (
          <StagedSource
            loaded={loaded}
            live={live}
            nothingUsable={importable.length === 0}
            onManual={setManual}
            reset={reset}
          />
        )}
      </div>
    </div>
  );
}
