// Notification preferences (docs/69 A-6) — browser push opt-in. Per-device:
// each browser subscribes separately, so this is a personal setting, not a
// tenant one (no module gate).

import { Bell } from 'lucide-react';
import { Card, Container, PageHeader, Stack, Text } from '@sparx/ui';

import { PushToggle } from './_components/push-toggle';

export const metadata = { title: 'Notifications' };
// Read the VAPID public key from runtime env (the ConfigMap), not a build-time
// NEXT_PUBLIC_* var, so rotating it doesn't require a dashboard rebuild.
export const dynamic = 'force-dynamic';

export default function NotificationsSettingsPage(): React.JSX.Element {
  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY ?? null;
  return (
    <Container size="md">
      <Stack gap={6} className="py-10">
        <PageHeader
          icon={<Bell className="h-5 w-5" />}
          title="Notifications"
          description="Get a browser notification the moment a customer chat needs a human. Enable it on each device you want alerts on — the choice is per-browser."
        />
        <Card padding="md">
          <Stack gap={3}>
            <Text size="sm" className="font-medium">
              Browser push
            </Text>
            <PushToggle vapidPublicKey={vapidPublicKey} />
          </Stack>
        </Card>
      </Stack>
    </Container>
  );
}
