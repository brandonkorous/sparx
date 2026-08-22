import { notFound } from 'next/navigation';
import { requireCapability } from '@wizeworks/operator-auth/next';
import { Card, PageHeader, Stack, Text } from '@wizeworks/ui';
import { OperatorApiError } from '@wizeworks/operator';
import { operatorApi } from '@/lib/operator-api';
import { announcementState } from '@/lib/announcements';
import { AnnouncementForm } from '../_components/announcement-form';

// Editing one notice.
//
// There is no `getAnnouncement` on the operator client and there does not need
// to be: the whole list is a handful of rows with no per-row detail to fetch, so
// asking for it and picking one costs a round trip and buys a second endpoint to
// keep in step. If this ever grows to the size where that stops being true, it
// will be obvious from this line.

export default async function EditAnnouncementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const operator = await requireCapability('announcement:manage');
  const { id } = await params;

  let error: string | null = null;
  let announcement = null;
  try {
    const result = await operatorApi().listAnnouncements({}, operator.id);
    announcement = result.announcements.find((a) => a.id === id) ?? null;
  } catch (err) {
    error = err instanceof OperatorApiError ? err.message : 'Could not reach api-rest.';
  }

  if (error) {
    return (
      <Card>
        <Text variant="muted">{error}</Text>
      </Card>
    );
  }
  if (!announcement) notFound();

  const state = announcementState(announcement);

  return (
    <Stack gap={6}>
      <PageHeader
        title="Edit notice"
        description={`This notice is ${state.label.toLowerCase()}. Saving takes effect within about a minute on every page it runs on.`}
      />
      <AnnouncementForm announcement={announcement} />
    </Stack>
  );
}
