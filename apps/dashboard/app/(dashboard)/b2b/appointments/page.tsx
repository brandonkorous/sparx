import { Calendar } from 'lucide-react';

import { ListPageShell, PageHeader } from '@sparx/ui';
import { Badge, Card, CardBody, EmptyState } from '@wizeworks/silicaui-react';

import { api } from '@/lib/api-rest-client';
import { getUserPreferences } from '../../_shell/preferences';
import { ListToolbar } from '../../_components/list-toolbar';
import { ListPager } from '../../_components/list-pager';
import { parsePageParams } from '@/lib/pagination';
import { AppointmentsList } from './_components/appointments-list';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

interface AppointmentRow {
  id: string;
  serviceTypeId: string;
  serviceTypeName: string | null;
  b2bAccountId: string | null;
  companyName: string | null;
  customerId: string | null;
  customerName: string | null;
  customerEmail: string | null;
  scheduledAt: string;
  durationMinutes: number;
  status: string;
  vehicleRef: Record<string, unknown> | null;
  notes: string | null;
  staffNotes: string | null;
  confirmedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  createdAt: string;
}

const STATUS_OPTIONS = [
  { value: 'requested', label: 'Requested' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

function stringParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  if (typeof v === 'string' && v.length > 0) return v;
  return undefined;
}

export default async function AppointmentsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { skip, take } = parsePageParams(params);
  const status = stringParam(params.status);
  // account_id stays URL-readable for deep links from an account page; it isn't
  // a toolbar control.
  const accountId = stringParam(params.account_id);

  const query = new URLSearchParams({ take: String(take), skip: String(skip) });
  if (status) query.set('status', status);
  if (accountId) query.set('account_id', accountId);

  const [prefs, { data: appointments, meta }] = await Promise.all([
    getUserPreferences(),
    api.getPaged<AppointmentRow[]>(`/v1/b2b/appointments?${query.toString()}`),
  ]);
  const total = (meta?.total as number | undefined) ?? appointments.length;

  const pendingCount = appointments.filter((a) =>
    ['requested', 'confirmed'].includes(a.status)
  ).length;

  const view = (stringParam(params.view) ?? prefs.defaultListView) === 'card' ? 'card' : 'table';

  return (
    <ListPageShell
      header={
        <PageHeader
          icon={<Calendar className="h-5 w-5" />}
          title="Appointments"
          badge={
            pendingCount > 0 ? (
              <Badge color="warning" variant="soft">
                {pendingCount} upcoming
              </Badge>
            ) : undefined
          }
          description="Manage B2B service appointments and track their status."
          className="mb-0"
        />
      }
      toolbar={
        <ListToolbar
          searchable={false}
          filters={[{ key: 'status', label: 'Status', options: STATUS_OPTIONS }]}
          enableViewToggle
        />
      }
      pager={<ListPager total={total} />}
    >
      {appointments.length === 0 ? (
        <Card>
          <CardBody className="p-0">
            <EmptyState
              icon={<Calendar className="h-5 w-5" />}
              title={status ? 'No appointments match this filter' : 'No appointments'}
              description={
                status
                  ? 'Clear the status filter to see every appointment.'
                  : 'Appointments booked from the B2B portal or created here will appear in this list.'
              }
            />
          </CardBody>
        </Card>
      ) : (
        <>
          <p className="text-base-content/70 text-sm">
            {total} appointment{total !== 1 ? 's' : ''} total
          </p>
          <AppointmentsList appointments={appointments} view={view} />
        </>
      )}
    </ListPageShell>
  );
}
