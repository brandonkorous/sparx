import { Settings as SettingsIcon } from 'lucide-react';
import { Card, CardBody, CardTitle } from 'silicaui-react';

import { api } from '@/lib/api-rest-client';
import { EmailShell } from '../_components/email-shell';
import { SettingsForm } from './settings-form';
import type { EmailSettingsView } from '../_lib/types';

export const dynamic = 'force-dynamic';

export default async function EmailSettingsPage() {
  const settings = await api.get<EmailSettingsView>('/v1/email/settings');

  return (
    <EmailShell
      icon={<SettingsIcon className="h-5 w-5" />}
      title="Settings"
      description="Sender identity, reply-to, and physical mailing address."
    >
      <Card>
        <CardBody>
          <CardTitle>Sender identity</CardTitle>
          <p className="opacity-70">
            These defaults apply to every transactional and marketing email unless a specific
            template or broadcast overrides them. Brand styling is inherited from your site theme.
          </p>
          <SettingsForm initial={settings} />
        </CardBody>
      </Card>
    </EmailShell>
  );
}
