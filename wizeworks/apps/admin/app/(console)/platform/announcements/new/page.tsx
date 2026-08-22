import { requireCapability } from '@wizeworks/operator-auth/next';
import { PageHeader, Stack } from '@wizeworks/ui';
import { AnnouncementForm } from '../_components/announcement-form';

export default async function NewAnnouncementPage() {
  // Default-deny, server-side. The nav hiding the link is not authorization.
  await requireCapability('announcement:manage');

  return (
    <Stack gap={6}>
      <PageHeader
        title="Write a notice"
        description="It goes live as soon as you switch it on, and comes down the same way. Nothing here needs a deploy."
      />
      <AnnouncementForm />
    </Stack>
  );
}
