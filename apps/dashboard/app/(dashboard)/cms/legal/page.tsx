import { Container, PageHeader, Stack } from '@sparx/ui';
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
    <Container size="full">
      <Stack gap={8} className="py-10">
        <PageHeader
          title="Legal"
          description="Your site's policy pages and cookie consent. sparx seeds editable starter templates — review them with your own counsel before publishing."
        />
        <LegalChecklist data={checklist} />
        <ConsentSettingsForm config={consent} />
      </Stack>
    </Container>
  );
}
