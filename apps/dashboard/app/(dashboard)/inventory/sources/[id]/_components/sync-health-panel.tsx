import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  Heading,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
} from '@sparx/ui';

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
      <CardHeader>
        <Stack direction="row" align="center" justify="between" wrap gap={2}>
          <Heading level={3}>Sync health</Heading>
          <Badge color={runStatusColor(latestRun?.status ?? 'neutral')} variant="soft">
            {latestRun ? `Last run: ${latestRun.status}` : 'No runs yet'}
          </Badge>
        </Stack>
      </CardHeader>
      <CardContent>
        <Stack gap={5}>
          <Stack direction="row" gap={3} wrap>
            <Tile label="Last sync" value={formatDateTime(health.lastSyncAt)} />
            <Tile label="Active mappings" value={String(health.activeLinkCount)} />
            <Tile
              label="Unmapped (pending)"
              value={String(health.pendingUnmappedCount)}
              emphasis={health.pendingUnmappedCount > 0}
            />
          </Stack>

          {latestRun ? <LatestRun run={latestRun} /> : null}

          {health.recentRuns.length > 0 ? (
            <Stack gap={2}>
              <Text size="sm" className="font-medium">
                Recent runs
              </Text>
              <RecentRunsTable runs={health.recentRuns} />
            </Stack>
          ) : (
            <Text size="sm" variant="muted">
              No syncs have run yet. Trigger one with “Sync now”, or push stock to this source via
              the API.
            </Text>
          )}
        </Stack>
      </CardContent>
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
    <Stack
      gap={1}
      className="min-w-[10rem] flex-1 rounded border border-[var(--color-border-default)] px-3 py-2"
    >
      <Text size="xs" variant="muted">
        {label}
      </Text>
      <Text size="lg" className={emphasis ? 'text-[var(--color-warning)]' : undefined}>
        {value}
      </Text>
    </Stack>
  );
}

function LatestRun({ run }: { run: SyncRunRow }) {
  return (
    <Stack
      gap={2}
      className="rounded border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-3 py-3"
    >
      <Stack direction="row" align="center" gap={2} wrap>
        <Badge color={runStatusColor(run.status)}>{run.status}</Badge>
        <Text size="sm" variant="muted">
          {triggerLabel(run.trigger)} · {formatDateTime(run.finishedAt ?? run.startedAt)}
        </Text>
      </Stack>
      <Stack direction="row" gap={4} wrap>
        <Metric label="Rows" value={run.rowsTotal} />
        <Metric label="Changed" value={run.rowsChanged} />
        <Metric label="Unchanged" value={run.rowsUnchanged} />
        <Metric label="Unmapped" value={run.rowsUnmatched} warn={run.rowsUnmatched > 0} />
        <Metric label="Skipped" value={run.rowsSkipped} warn={run.rowsSkipped > 0} />
      </Stack>
      {run.error ? (
        <Text size="sm" className="text-[var(--color-danger)]">
          {run.error}
        </Text>
      ) : null}
    </Stack>
  );
}

function Metric({ label, value, warn = false }: { label: string; value: number; warn?: boolean }) {
  return (
    <Stack gap={0}>
      <Text size="lg" className={warn && value > 0 ? 'text-[var(--color-warning)]' : undefined}>
        {value}
      </Text>
      <Text size="xs" variant="muted">
        {label}
      </Text>
    </Stack>
  );
}

function RecentRunsTable({ runs }: { runs: SyncRunRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>When</TableHead>
          <TableHead>Trigger</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Rows</TableHead>
          <TableHead className="text-right">Changed</TableHead>
          <TableHead className="text-right">Unmapped</TableHead>
          <TableHead className="text-right">Skipped</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {runs.map((r) => (
          <TableRow key={r.id}>
            <TableCell>{formatDateTime(r.finishedAt ?? r.startedAt)}</TableCell>
            <TableCell>{triggerLabel(r.trigger)}</TableCell>
            <TableCell>
              <Badge color={runStatusColor(r.status)} variant="soft" size="sm">
                {r.status}
              </Badge>
            </TableCell>
            <TableCell className="text-right">{r.rowsTotal}</TableCell>
            <TableCell className="text-right">{r.rowsChanged}</TableCell>
            <TableCell className="text-right">{r.rowsUnmatched}</TableCell>
            <TableCell className="text-right">{r.rowsSkipped}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
