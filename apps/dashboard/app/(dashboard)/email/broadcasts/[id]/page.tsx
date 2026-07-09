import { notFound } from 'next/navigation';
import type { ComponentProps } from 'react';

import { PageHeader } from '@sparx/ui';
import { Badge, Card, CardBody, CardTitle } from '@wizeworks/silicaui-react';

import { api, type ApiRestError } from '@/lib/api-rest-client';
import { BroadcastActions } from './broadcast-actions';
import type { BroadcastRow, BroadcastStats } from '../../_lib/types';

export const dynamic = 'force-dynamic';

const STATUS_BADGE: Record<BroadcastRow['status'], ComponentProps<typeof Badge>['color']> = {
  draft: 'neutral',
  scheduled: 'warning',
  sending: 'info',
  sent: 'success',
  cancelled: 'neutral',
  failed: 'danger',
};

const STAT_LABELS: { key: keyof BroadcastStats; label: string }[] = [
  { key: 'accepted', label: 'Accepted' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'opened', label: 'Opened' },
  { key: 'clicked', label: 'Clicked' },
  { key: 'bounced', label: 'Bounced' },
  { key: 'complained', label: 'Complaints' },
  { key: 'unsubscribed', label: 'Unsubscribed' },
];

export default async function BroadcastDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let broadcast: BroadcastRow;
  try {
    broadcast = await api.get<BroadcastRow>(`/v1/email/broadcasts/${id}`);
  } catch (err) {
    if ((err as ApiRestError).code === 'NOT_FOUND') notFound();
    throw err;
  }

  const stats =
    broadcast.status === 'sent' || broadcast.status === 'sending'
      ? await api.get<BroadcastStats>(`/v1/email/broadcasts/${id}/stats`).catch(() => null)
      : null;

  return (
    <div className="mx-auto w-full max-w-screen-xl px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 py-10">
        <PageHeader
          title={broadcast.name}
          badge={
            <Badge color={STATUS_BADGE[broadcast.status]} variant="soft">
              {broadcast.status}
            </Badge>
          }
          description={broadcast.subject}
        />

        {broadcast.status === 'draft' || broadcast.status === 'scheduled' ? (
          <Card>
            <CardBody>
              <CardTitle>Send</CardTitle>
              <BroadcastActions broadcast={broadcast} />
            </CardBody>
          </Card>
        ) : null}

        {stats ? (
          <Card>
            <CardBody>
              <CardTitle>Performance</CardTitle>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {STAT_LABELS.map(({ key, label }) => (
                  <div key={key} className="flex flex-col gap-1">
                    <h2 className="text-2xl font-semibold tracking-tight">{stats[key]}</h2>
                    <p className="text-base-content/70 text-sm">{label}</p>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
