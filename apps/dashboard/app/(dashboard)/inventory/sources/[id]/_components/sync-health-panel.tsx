import { Badge, Card, CardBody, Table } from '@wizeworks/silicaui-react';

import {
  formatDateTime,
  runStatusColor,
  triggerLabel,
  type SyncHealth,
  type SyncRunRow,
} from './types';

// Sync-health panel (docs/100 P5) — the at-a-glance answer to "is this source
// healthy and what did the last sync do?". Status + last sync + mapping/unmapped
// counts as stat tiles, the latest run's row breakdown, and a recent-runs table.
// Pure server display; the data comes from /v1/inventory/sources/:id/health.

export function SyncHealthPanel({ health }: { health: SyncHealth }) {
  const { latestRun } = health;

  return (
    <Card>
      <CardBody>
        <div className="flex flex-row flex-wrap items-center justify-between gap-2">
          <h3 className="text-xl font-semibold">Sync health</h3>
          <Badge color={runStatusColor(latestRun?.status ?? 'neutral')} variant="soft">
            {latestRun ? `Last run: ${latestRun.status}` : 'No runs yet'}
          </Badge>
        </div>
        <div className="flex flex-col gap-5">
          <div className="flex flex-row flex-wrap gap-3">
            <Tile label="Last sync" value={formatDateTime(health.lastSyncAt)} />
            <Tile label="Active mappings" value={String(health.activeLinkCount)} />
            <Tile
              label="Unmapped (pending)"
              value={String(health.pendingUnmappedCount)}
              emphasis={health.pendingUnmappedCount > 0}
            />
            <Tile
              label="Stale mappings"
              value={String(health.staleLinkCount)}
              emphasis={health.staleLinkCount > 0}
            />
          </div>

          {latestRun ? <LatestRun run={latestRun} /> : null}

          {health.recentRuns.length > 0 ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">Recent runs</p>
              <RecentRunsTable runs={health.recentRuns} />
            </div>
          ) : (
            <p className="text-base-content/70 text-sm">
              No syncs have run yet. Trigger one with “Sync now”, or push stock to this source via
              the API.
            </p>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

function Tile({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="border-base-300 flex min-w-[10rem] flex-1 flex-col gap-1 rounded border px-3 py-2">
      <p className="text-base-content/70 text-xs">{label}</p>
      <p className={emphasis ? 'text-warning text-lg' : 'text-lg'}>{value}</p>
    </div>
  );
}

function LatestRun({ run }: { run: SyncRunRow }) {
  return (
    <div className="border-base-300 bg-base-200 flex flex-col gap-2 rounded border px-3 py-3">
      <div className="flex flex-row flex-wrap items-center gap-2">
        <Badge color={runStatusColor(run.status)}>{run.status}</Badge>
        <p className="text-base-content/70 text-sm">
          {triggerLabel(run.trigger)} · {formatDateTime(run.finishedAt ?? run.startedAt)}
        </p>
      </div>
      <div className="flex flex-row flex-wrap gap-4">
        <Metric label="Rows" value={run.rowsTotal} />
        <Metric label="Changed" value={run.rowsChanged} />
        <Metric label="Unchanged" value={run.rowsUnchanged} />
        <Metric label="Unmapped" value={run.rowsUnmatched} warn={run.rowsUnmatched > 0} />
        <Metric label="Out-of-order" value={run.rowsStale} warn={run.rowsStale > 0} />
        <Metric label="Skipped" value={run.rowsSkipped} warn={run.rowsSkipped > 0} />
      </div>
      {run.error ? <p className="text-danger text-sm">{run.error}</p> : null}
    </div>
  );
}

function Metric({ label, value, warn = false }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className="flex flex-col gap-0">
      <p className={warn && value > 0 ? 'text-warning text-lg' : 'text-lg'}>{value}</p>
      <p className="text-base-content/70 text-xs">{label}</p>
    </div>
  );
}

function RecentRunsTable({ runs }: { runs: SyncRunRow[] }) {
  return (
    <Table>
      <thead>
        <tr>
          <th>When</th>
          <th>Trigger</th>
          <th>Status</th>
          <th className="text-right">Rows</th>
          <th className="text-right">Changed</th>
          <th className="text-right">Unmapped</th>
          <th className="text-right">Skipped</th>
        </tr>
      </thead>
      <tbody>
        {runs.map((r) => (
          <tr key={r.id}>
            <td>{formatDateTime(r.finishedAt ?? r.startedAt)}</td>
            <td>{triggerLabel(r.trigger)}</td>
            <td>
              <Badge color={runStatusColor(r.status)} variant="soft" size="sm">
                {r.status}
              </Badge>
            </td>
            <td className="text-right">{r.rowsTotal}</td>
            <td className="text-right">{r.rowsChanged}</td>
            <td className="text-right">{r.rowsUnmatched}</td>
            <td className="text-right">{r.rowsSkipped}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
