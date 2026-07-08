import { PageHeader } from '@sparx/ui';
import { Card, CardBody, CardTitle } from 'silicaui-react';

import { api } from '@/lib/api-rest-client';
import { BroadcastComposer, type BuilderEmailOption } from '../_components/broadcast-composer';
import type { SegmentOption } from '../../_lib/types';

export const dynamic = 'force-dynamic';

// A Builder email a broadcast can use as its body (docs/52). Only PUBLISHED ones
// are selectable — the send renders the published snapshot.
interface BuilderEmailListItem {
  id: string;
  name: string;
  published: boolean;
}

export default async function NewBroadcastPage() {
  const [segments, builderEmails] = await Promise.all([
    // List paginates (default 50); broadcast targeting needs every segment.
    api.get<SegmentOption[]>('/v1/crm/segments?take=250').catch(() => [] as SegmentOption[]),
    api
      .get<{ emails: BuilderEmailListItem[] }>('/v1/builder/emails')
      .then((r) => r.emails)
      .catch(() => [] as BuilderEmailListItem[]),
  ]);

  const designedEmails: BuilderEmailOption[] = builderEmails
    .filter((e) => e.published)
    .map((e) => ({ id: e.id, name: e.name }));

  return (
    <div className="mx-auto w-full max-w-screen-md px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 py-10">
        <PageHeader title="New broadcast" />

        <Card>
          <CardBody>
            <CardTitle>Compose</CardTitle>
            <BroadcastComposer
              segments={segments.map((s) => ({ id: s.id, name: s.name }))}
              designedEmails={designedEmails}
            />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
