import { PageHeader } from '@sparx/ui';
import { api } from '@/lib/api-rest-client';
import { LegalChecklist, type ChecklistData } from './legal-checklist';
import { ConsentSettingsForm, type ConsentConfig } from './consent-settings-form';

export const dynamic = 'force-dynamic';

export default async function LegalPage() {
  const [checklist, consent] = await Promise.all([
    api.get<ChecklistData>('/v1/legal/checklist'),
    api.get<ConsentConfig>('/v1/tenant/consent'),
  ]);

  return (
    <div className="mx-auto w-full max-w-none px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-8 py-10">
        <PageHeader
          title="Legal"
          description="Your site's policy pages and cookie consent. sparx seeds editable starter templates — review them with your own counsel before publishing."
        />
        <LegalChecklist data={checklist} />
        <ConsentSettingsForm config={consent} />
      </div>
    </div>
  );
}
