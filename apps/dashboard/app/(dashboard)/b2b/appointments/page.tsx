import { Calendar } from 'lucide-react';
import Link from 'next/link';

import {
  Badge,
  Card,
  Container,
  EmptyState,
  PageHeader,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
} from '@sparx/ui';

import { api } from '@/lib/api-rest-client';
import { AppointmentActions } from './_components/appointment-actions';

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

const STATUS_BADGE: Record<string, 'outline' | 'info' | 'success' | 'warning' | 'danger'> = {
  requested: 'outline',
  confirmed: 'info',
  in_progress: 'warning',
  completed: 'success',
  cancelled: 'danger',
};

const STATUS_LABEL: Record<string, string> = {
  requested: 'Requested',
  confirmed: 'Confirmed',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

function stringParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function vehicleLabel(ref: Record<string, unknown> | null): string | null {
  if (!ref) return null;
  const parts = [ref.year, ref.make, ref.model].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : null;
}

export default async function AppointmentsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const status = stringParam(params.status);
  const accountId = stringParam(params.account_id);

  const query = new URLSearchParams({ take: '100' });
  if (status) query.set('status', status);
  if (accountId) query.set('account_id', accountId);

  const { data: appointments, meta } = await api.getPaged<AppointmentRow[]>(
    `/v1/b2b/appointments?${query.toString()}`
  );
  const total = (meta?.total as number | undefined) ?? appointments.length;

  const pendingCount = appointments.filter((a) =>
    ['requested', 'confirmed'].includes(a.status)
  ).length;

  return (
    <Container size="full">
      <Stack gap={6} className="py-10">
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
        />

        {appointments.length === 0 ? (
          <Card padding="none">
            <EmptyState
              icon={<Calendar className="h-5 w-5" />}
              title="No appointments"
              description="Appointments booked from the B2B portal or created here will appear in this list."
            />
          </Card>
        ) : (
          <>
            <Text size="sm" variant="muted">
              {total} appointment{total !== 1 ? 's' : ''} total
            </Text>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Scheduled</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {appointments.map((appt) => (
                  <TableRow key={appt.id}>
                    <TableCell>
                      <Text size="sm" className="font-medium whitespace-nowrap tabular-nums">
                        {formatDateTime(appt.scheduledAt)}
                      </Text>
                      <Text size="xs" variant="muted">
                        {appt.durationMinutes} min
                      </Text>
                    </TableCell>
                    <TableCell>
                      <Text size="sm">{appt.serviceTypeName ?? '—'}</Text>
                    </TableCell>
                    <TableCell>
                      {appt.b2bAccountId ? (
                        <Link
                          href={`/b2b/accounts/${appt.b2bAccountId}`}
                          className="text-sm hover:text-[var(--module-active)] hover:underline"
                        >
                          {appt.companyName ?? appt.b2bAccountId}
                        </Link>
                      ) : (
                        <Text size="sm" variant="muted">
                          —
                        </Text>
                      )}
                    </TableCell>
                    <TableCell>
                      <Stack gap={1}>
                        <Text size="sm">{appt.customerName ?? appt.customerEmail ?? '—'}</Text>
                        {appt.customerName && appt.customerEmail && (
                          <Text size="xs" variant="muted">
                            {appt.customerEmail}
                          </Text>
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Text size="sm" variant="muted">
                        {vehicleLabel(appt.vehicleRef) ?? '—'}
                      </Text>
                    </TableCell>
                    <TableCell>
                      <Badge
                        color={
                          (STATUS_BADGE[appt.status] ?? 'outline') as
                            | 'outline'
                            | 'info'
                            | 'success'
                            | 'warning'
                            | 'danger'
                        }
                        variant="soft"
                        size="sm"
                      >
                        {STATUS_LABEL[appt.status] ?? appt.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <AppointmentActions appointment={appt} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </Stack>
    </Container>
  );
}
