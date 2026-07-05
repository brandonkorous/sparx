import { Inbox, MailPlus } from 'lucide-react';
import { Badge, Card, Container, EmptyState, PageHeader, Stack } from '@sparx/ui';
import { requireSession } from '@sparx/auth';

import { api } from '@/lib/api-rest-client';

import { ListToolbar } from '../../_components/list-toolbar';
import { listModuleStateForCurrentTenant } from '../../settings/modules/actions';
import { CrmUpsellBanner } from './_components/crm-upsell-banner';
import { SubmissionsList } from './_components/submissions-list';
import {
  STATUS_LABEL,
  SUBMISSIONS_PAGE_SIZE,
  SUBMISSION_STATUSES,
  type FormSubmissionStatus,
  type SubmissionListResponse,
} from './types';

// Form submissions inbox (docs/115 §6) — a Builder-module surface listing the
// messages visitors send through Contact form blocks. The builder gate runs in
// the parent builder/layout.tsx; this page just reads the inbox. Status filter
// lives in the URL (?status=new) so links + the back button work.

export const dynamic = 'force-dynamic';

const STATUS_FILTER_OPTIONS = SUBMISSION_STATUSES.map((s) => ({
  value: s,
  label: STATUS_LABEL[s],
}));

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function stringParam(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

const EMPTY_RESPONSE: SubmissionListResponse = {
  submissions: [],
  counts: { total: 0, new: 0 },
};

export default async function FormSubmissionsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const statusRaw = stringParam(params.status);
  const status = (SUBMISSION_STATUSES as readonly string[]).includes(statusRaw ?? '')
    ? (statusRaw as FormSubmissionStatus)
    : undefined;

  const query = new URLSearchParams();
  query.set('limit', String(SUBMISSIONS_PAGE_SIZE));
  if (status) query.set('status', status);

  const [data, moduleState, session] = await Promise.all([
    api
      .get<SubmissionListResponse>(`/v1/forms/submissions?${query.toString()}`)
      .catch(() => EMPTY_RESPONSE),
    listModuleStateForCurrentTenant().catch(() => []),
    requireSession(),
  ]);

  const crmEnabled = moduleState.find((m) => m.slug === 'crm')?.enabled ?? false;
  const canActivateCrm = session.user.role === 'owner' || session.user.role === 'admin';
  const { submissions, counts } = data;

  return (
    <Container size="full">
      <Stack gap={6} className="py-10">
        <PageHeader
          className="mb-0"
          icon={<Inbox className="h-5 w-5" />}
          title="Form submissions"
          badge={
            counts.new > 0 ? (
              <Badge color="info" variant="soft">
                {counts.new} new
              </Badge>
            ) : undefined
          }
          description="Messages people send through the contact forms on your site. Every one is saved here — read it, reply, or clear out spam."
        />

        {!crmEnabled ? <CrmUpsellBanner canActivate={canActivateCrm} /> : null}

        <ListToolbar
          searchable={false}
          filters={[{ key: 'status', label: 'Status', options: STATUS_FILTER_OPTIONS }]}
          enableSavedViews={false}
        />

        {submissions.length === 0 ? (
          <Card padding="none">
            <EmptyState
              icon={<MailPlus className="h-5 w-5" />}
              title={
                status ? `No ${STATUS_LABEL[status].toLowerCase()} messages` : 'No submissions yet'
              }
              description={
                status
                  ? 'Try a different status above, or clear the filter to see everything.'
                  : 'Add a Contact form block to a page on your site — messages people send through it will land right here.'
              }
            />
          </Card>
        ) : (
          <SubmissionsList initial={submissions} status={status} />
        )}
      </Stack>
    </Container>
  );
}
