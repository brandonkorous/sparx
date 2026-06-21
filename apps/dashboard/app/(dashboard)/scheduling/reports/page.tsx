export const dynamic = 'force-dynamic';

import { BarChart3 } from 'lucide-react';
import { Container, PageHeader, Stack } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';
import type { SchedulingReport } from '../_lib/types';
import { ReportView } from './_components/report-view';

export default async function SchedulingReportsPage() {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 30);
  const report = await api
    .get<SchedulingReport>(
      `/v1/scheduling/reports?from=${from.toISOString()}&to=${to.toISOString()}`
    )
    .catch(() => null);

  return (
    <Container size="xl">
      <Stack gap={6} className="py-10">
        <PageHeader
          icon={<BarChart3 className="h-5 w-5" />}
          title="Reports"
          description="Booking volume, outcomes, no-show rate, and completed revenue over a date range."
        />
        <ReportView initial={report} />
      </Stack>
    </Container>
  );
}
