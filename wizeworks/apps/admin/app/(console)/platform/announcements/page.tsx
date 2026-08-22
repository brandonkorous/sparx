import Link from 'next/link';
import { requireCapability } from '@wizeworks/operator-auth/next';
import { logOperatorAction } from '@wizeworks/operator-auth';
import { Button, Card, PageHeader, Stack, Text } from '@wizeworks/ui';
import { OperatorApiError, type OperatorAnnouncementListResult } from '@wizeworks/operator';
import { operatorApi } from '@/lib/operator-api';
import { AnnouncementsTable } from './_components/announcements-table';

// The header notice bar, for both products.
//
// It lives under /platform rather than /sparx because it is not a sparx surface:
// one screen writes the bar for sparx.works and for meetpiggles.com, and filing
// it under one brand's section would leave an operator hunting for the other's.

export default async function AnnouncementsPage() {
  const operator = await requireCapability('announcement:manage');

  try {
    await logOperatorAction({
      operatorId: operator.id,
      operatorEmail: operator.email,
      capability: 'announcement:manage',
      action: 'announcement.list.view',
    });
  } catch {
    // best-effort — a logging failure must never blank the page
  }

  let result: OperatorAnnouncementListResult | null = null;
  let error: string | null = null;
  try {
    result = await operatorApi().listAnnouncements({}, operator.id);
  } catch (err) {
    error = err instanceof OperatorApiError ? err.message : 'Could not reach api-rest.';
  }

  return (
    <Stack gap={6}>
      <PageHeader
        title="Header notices"
        description="The one line that sits above every page of a product — an offer, a price change, planned work. Written here, live in about a minute, and taken down the same way. Only one notice shows in a place at a time."
      />

      <Stack direction="row" justify="end">
        <Button asChild color="primary">
          <Link href="/platform/announcements/new">Write a notice</Link>
        </Button>
      </Stack>

      {error ? (
        <Card>
          <Text variant="muted">{error}</Text>
        </Card>
      ) : result && result.announcements.length > 0 ? (
        <AnnouncementsTable announcements={result.announcements} />
      ) : (
        <Card>
          <Stack gap={2}>
            <Text weight="medium">Nothing is being announced.</Text>
            <Text variant="muted">
              Every page of both products is running without a bar above it, which is the right
              state most of the time. Write one when there is something worth interrupting for.
            </Text>
          </Stack>
        </Card>
      )}
    </Stack>
  );
}
