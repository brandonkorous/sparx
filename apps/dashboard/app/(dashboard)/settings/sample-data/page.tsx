// Sample data — load a complete, realistic dataset for your industry so you can
// see how every module connects before you bring your own. Products with reviews
// and Q&A, customers with orders and returns, articles, bookings, quotes — all
// wired together, all reversible. Sits beside Industry in settings: Industry picks
// the CONFIG, this fills it with example ACTIVITY. Admin-only; clearing is exact.

import { FlaskConical } from 'lucide-react';
import { requireSession } from '@sparx/auth';
import { Container, PageHeader, Stack } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';

import type { SampleDataStatus } from './actions';
import { SampleDataPanel } from './_components/sample-data-panel';

export const dynamic = 'force-dynamic';

export default async function SampleDataSettingsPage() {
  const session = await requireSession();
  const status = await api.get<SampleDataStatus>('/v1/sample-data');
  const canEdit = session.user.role === 'owner' || session.user.role === 'admin';

  return (
    <Container size="xl">
      <Stack gap={6} className="py-10">
        <PageHeader
          icon={<FlaskConical className="h-5 w-5" />}
          title="Sample data"
          description={
            <>
              Load a complete, realistic dataset for your industry — products with reviews and
              Q&amp;A, customers with orders and returns, articles, bookings, and quotes — so you
              can see how the modules connect before bringing your own. It only touches your enabled
              modules, and clearing removes exactly what was loaded, nothing of your own.
              {!canEdit && ' Only owners and admins can load or clear sample data.'}
            </>
          }
        />

        <SampleDataPanel status={status} canEdit={canEdit} />
      </Stack>
    </Container>
  );
}
