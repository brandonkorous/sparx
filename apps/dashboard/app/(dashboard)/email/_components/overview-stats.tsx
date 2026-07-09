// Server-rendered analytics summary for the Email Overview page — headline
// engagement tiles + recent activity, from /v1/email/analytics/overview.

import { Badge, type BadgeProps, statusLabel } from '@sparx/ui';
import { Card, CardBody, CardTitle, Table } from '@wizeworks/silicaui-react';

import type { OverviewResult } from '../_lib/types';

function pct(n: number, d: number): string {
  if (d <= 0) return '—';
  return `${Math.round((n / d) * 100)}%`;
}

const EVENT_BADGE: Record<string, BadgeProps['color']> = {
  accepted: 'outline',
  delivered: 'success',
  opened: 'soft',
  clicked: 'module',
  bounced: 'danger',
  complained: 'danger',
  unsubscribed: 'warning',
  failed: 'danger',
};

export function OverviewStats({ overview }: { overview: OverviewResult }) {
  const { counts, suppressedTotal, recent, days } = overview;
  const tiles = [
    { label: 'Accepted', value: String(counts.accepted) },
    { label: 'Delivered', value: String(counts.delivered) },
    { label: 'Open rate', value: pct(counts.opened, counts.delivered) },
    { label: 'Click rate', value: pct(counts.clicked, counts.delivered) },
    { label: 'Bounced', value: String(counts.bounced) },
    { label: 'Suppressed', value: String(suppressedTotal) },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardBody>
          <CardTitle>Last {days} days</CardTitle>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            {tiles.map((t) => (
              <div key={t.label} className="flex flex-col gap-1">
                <h2 className="text-2xl font-semibold tracking-tight">{t.value}</h2>
                <p className="text-base-content/70 text-sm">{t.label}</p>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      {recent.length > 0 ? (
        <Card>
          <CardBody>
            <CardTitle>Recent activity</CardTitle>
            <Table>
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Recipient</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((e, i) => (
                  <tr key={`${e.recipient}-${e.occurredAt}-${i}`}>
                    <td>
                      <Badge color={EVENT_BADGE[e.type] ?? 'neutral'} variant="soft" size="sm">
                        {statusLabel(e.type)}
                      </Badge>
                    </td>
                    <td>{e.recipient}</td>
                    <td>{new Date(e.occurredAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
