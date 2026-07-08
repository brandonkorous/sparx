// Notification preferences (docs/69 A-6) — browser push opt-in. Per-device:
// each browser subscribes separately, so this is a personal setting, not a
// tenant one (no module gate).

import { Bell } from 'lucide-react';
import { PageHeader } from '@sparx/ui';
import { Card, CardBody } from 'silicaui-react';

import { PushToggle } from './_components/push-toggle';

export const metadata = { title: 'Notifications' };
// Read the VAPID public key from runtime env (the ConfigMap), not a build-time
// NEXT_PUBLIC_* var, so rotating it doesn't require a dashboard rebuild.
export const dynamic = 'force-dynamic';

export default function NotificationsSettingsPage(): React.JSX.Element {
  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY ?? null;
  return (
    <div className="mx-auto w-full max-w-screen-md px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 py-10">
        <PageHeader
          icon={<Bell className="h-5 w-5" />}
          title="Notifications"
          description="Get a browser notification the moment a customer chat needs a human. Enable it on each device you want alerts on — the choice is per-browser."
        />
        <Card>
          <CardBody>
            <div className="flex flex-col gap-3">
              <p className="text-sm font-medium">Browser push</p>
              <PushToggle vapidPublicKey={vapidPublicKey} />
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
