import { Card, CardContent, CardHeader, CardTitle, Container, PageHeader, Stack } from '@sparx/ui';

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
    <Container size="md">
      <Stack gap={6} className="py-10">
        <PageHeader title="New broadcast" />

        <Card>
          <CardHeader>
            <CardTitle>Compose</CardTitle>
          </CardHeader>
          <CardContent>
            <BroadcastComposer
              segments={segments.map((s) => ({ id: s.id, name: s.name }))}
              designedEmails={designedEmails}
            />
          </CardContent>
        </Card>
      </Stack>
    </Container>
  );
}
