import Link from 'next/link';
import {
  Badge,
  Card,
  cn,
  Heading,
  ModuleProvider,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
} from '@wizeworks/ui';
import type { OperatorAcquisitionBucket, OperatorAcquisitionSummary } from '@wizeworks/operator';
import {
  channelLabel,
  channelModule,
  channelTone,
  sharePct,
  UNATTRIBUTED,
} from '@/lib/acquisition';
import { formatDate } from '@/lib/format';

// Where our own tenants came from (docs/80 §10) — the channel / source / campaign
// breakdown of `tenants.acquisition_*`, read through the operator seam.
//
// ── THE UN-MEASURED COUNT IS A HEADLINE, NOT A FOOTNOTE ─────────────────────
//
// Every figure here counts ACCOUNTS CREATED, never visits. Somebody who scanned a
// QR code, read the pricing page and closed the tab is in none of these numbers
// and never will be — attribution is written once, at signup. So the "Not
// measured" tile sits in the same row as the rest, at the same size: it is the
// share of signups whose origin was never captured (they declined the consent
// bar, or they predate attribution), and it is the honest denominator for
// everything below it. Demoting it would turn an absence into a measurement.

/** A channel's badge — module hue for AI · MCP, semantic tone for the rest. */
function ChannelBadge({ channel }: { channel: string }) {
  const module = channelModule(channel);
  if (module) {
    return (
      <ModuleProvider module={module}>
        <Badge color="module" variant="soft">
          {channelLabel(channel)}
        </Badge>
      </ModuleProvider>
    );
  }
  return (
    <Badge color={channelTone(channel)} variant="soft">
      {channelLabel(channel)}
    </Badge>
  );
}

function Tile({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string | null;
  tone?: 'danger';
}) {
  return (
    <Card>
      <Stack gap={1}>
        <Text size="sm">{label}</Text>
        <Text
          className={cn(
            'text-2xl font-medium tracking-tight tabular-nums',
            tone === 'danger' && 'text-danger'
          )}
        >
          {value}
        </Text>
        {sub ? <Text size="sm">{sub}</Text> : null}
      </Stack>
    </Card>
  );
}

export function AcquisitionTotals({ summary }: { summary: OperatorAcquisitionSummary }) {
  const { totals } = summary;
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Tile label="Signups in window" value={totals.tenants.toLocaleString('en-US')} />
      <Tile
        label="Attributed"
        value={totals.attributed.toLocaleString('en-US')}
        sub={sharePct(totals.attributed, totals.tenants)}
      />
      <Tile
        label="Not measured"
        value={totals.unattributed.toLocaleString('en-US')}
        sub={sharePct(totals.unattributed, totals.tenants)}
        tone="danger"
      />
      <Tile
        label="Reached billing"
        value={totals.withBilling.toLocaleString('en-US')}
        sub={sharePct(totals.withBilling, totals.tenants)}
      />
    </div>
  );
}

/** One breakdown table. `linkCampaign` turns each key into a filtered tenant list
 *  — a campaign report's whole job is to end at the accounts it produced. */
function BreakdownCard({
  title,
  description,
  rows,
  keyHeading,
  showChannel,
  linkCampaign,
  emptyMessage,
}: {
  title: string;
  description: string;
  rows: OperatorAcquisitionBucket[];
  keyHeading: string;
  showChannel: boolean;
  linkCampaign?: boolean;
  emptyMessage: string;
}) {
  return (
    <Card>
      <Stack gap={3}>
        <Stack gap={1}>
          <Heading level={3}>{title}</Heading>
          <Text size="sm">{description}</Text>
        </Stack>
        {rows.length === 0 ? (
          <Text>{emptyMessage}</Text>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{keyHeading}</TableHead>
                  {showChannel ? <TableHead>Channel</TableHead> : null}
                  <TableHead className="text-right">Signups</TableHead>
                  <TableHead className="text-right">Reached billing</TableHead>
                  <TableHead className="text-right">Active</TableHead>
                  <TableHead>First</TableHead>
                  <TableHead>Latest</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.key}>
                    <TableCell>
                      {!showChannel ? (
                        <ChannelBadge channel={row.key} />
                      ) : linkCampaign ? (
                        <Link
                          href={`/sparx/tenants?campaign=${encodeURIComponent(row.key)}`}
                          className="text-base-content font-medium hover:underline"
                        >
                          {row.key}
                        </Link>
                      ) : (
                        <Text className="font-medium">{row.key}</Text>
                      )}
                    </TableCell>
                    {showChannel ? (
                      <TableCell>
                        <ChannelBadge channel={row.channel} />
                      </TableCell>
                    ) : null}
                    <TableCell className="text-right tabular-nums">
                      <Text size="sm">{row.tenants.toLocaleString('en-US')}</Text>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <Text size="sm">{row.withBilling.toLocaleString('en-US')}</Text>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <Text size="sm">{row.active.toLocaleString('en-US')}</Text>
                    </TableCell>
                    <TableCell>
                      <Text size="sm">{formatDate(row.firstAcquiredAt) ?? '—'}</Text>
                    </TableCell>
                    <TableCell>
                      <Text size="sm">{formatDate(row.lastAcquiredAt) ?? '—'}</Text>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Stack>
    </Card>
  );
}

export function AcquisitionByChannel({ summary }: { summary: OperatorAcquisitionSummary }) {
  const measured = summary.byChannel.some((r) => r.key !== UNATTRIBUTED);
  return (
    <BreakdownCard
      title="By channel"
      description="How each account first reached us. Amber is a channel we pay per signup for; green is one we earned."
      rows={summary.byChannel}
      keyHeading="Channel"
      showChannel={false}
      emptyMessage={
        summary.totals.tenants === 0
          ? 'No accounts were created in this window.'
          : measured
            ? 'No channels to show.'
            : 'Nothing in this window carried a recorded channel.'
      }
    />
  );
}

export function AcquisitionBySource({ summary }: { summary: OperatorAcquisitionSummary }) {
  return (
    <BreakdownCard
      title="By source"
      description="The specific property a signup came from — a search engine, a directory, a partner."
      rows={summary.bySource}
      keyHeading="Source"
      showChannel
      emptyMessage={
        summary.totals.tenants === 0
          ? 'No accounts were created in this window.'
          : 'No signup in this window carried a source tag.'
      }
    />
  );
}

export function AcquisitionByCampaign({ summary }: { summary: OperatorAcquisitionSummary }) {
  return (
    <BreakdownCard
      title="By campaign"
      description="Signups per tagged campaign. Open one to see the accounts it produced."
      rows={summary.byCampaign}
      keyHeading="Campaign"
      showChannel
      linkCampaign
      emptyMessage={
        summary.totals.tenants === 0
          ? 'No accounts were created in this window.'
          : 'No signup in this window carried a campaign tag. A campaign appears here once a tagged link brings somebody in.'
      }
    />
  );
}
