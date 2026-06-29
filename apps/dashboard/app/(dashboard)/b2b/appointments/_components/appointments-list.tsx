'use client';

import Link from 'next/link';
import {
  Badge,
  type SelectionCard,
  type SelectionColumn,
  SelectionList,
  Stack,
  Text,
} from '@sparx/ui';

import { AppointmentActions } from './appointment-actions';

// Client wrapper for the B2B appointments list. SelectionList takes render
// functions (columns/card) which can't cross the server→client boundary, so the
// server page hands serializable rows + view and this builds both views.
// Read-only list (`selectable={false}` — no checkboxes / bulk bar); each row
// keeps its per-appointment confirm/complete/cancel island.

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

interface AppointmentsListProps {
  appointments: AppointmentRow[];
  view: 'table' | 'card';
}

export function AppointmentsList({ appointments, view }: AppointmentsListProps) {
  const accountCell = (appt: AppointmentRow) =>
    appt.b2bAccountId ? (
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
    );

  const statusBadge = (appt: AppointmentRow) => (
    <Badge color={STATUS_BADGE[appt.status] ?? 'neutral'} variant="soft" size="sm">
      {STATUS_LABEL[appt.status] ?? appt.status}
    </Badge>
  );

  const columns: SelectionColumn<AppointmentRow>[] = [
    {
      header: 'Scheduled',
      cell: (appt) => (
        <Stack gap={1}>
          <Text size="sm" className="font-medium whitespace-nowrap tabular-nums">
            {formatDateTime(appt.scheduledAt)}
          </Text>
          <Text size="xs" variant="muted">
            {appt.durationMinutes} min
          </Text>
        </Stack>
      ),
    },
    {
      header: 'Service',
      cell: (appt) => <Text size="sm">{appt.serviceTypeName ?? '—'}</Text>,
    },
    { header: 'Account', cell: accountCell },
    {
      header: 'Customer',
      cell: (appt) => (
        <Stack gap={1}>
          <Text size="sm">{appt.customerName ?? appt.customerEmail ?? '—'}</Text>
          {appt.customerName && appt.customerEmail && (
            <Text size="xs" variant="muted">
              {appt.customerEmail}
            </Text>
          )}
        </Stack>
      ),
    },
    {
      header: 'Vehicle',
      cell: (appt) => (
        <Text size="sm" variant="muted">
          {vehicleLabel(appt.vehicleRef) ?? '—'}
        </Text>
      ),
    },
    { header: 'Status', cell: statusBadge },
    {
      header: '',
      id: 'actions',
      align: 'right',
      cell: (appt) => <AppointmentActions appointment={appt} />,
    },
  ];

  const card: SelectionCard<AppointmentRow> = {
    title: (appt) => (
      <Text size="sm" className="truncate font-medium whitespace-nowrap tabular-nums">
        {formatDateTime(appt.scheduledAt)}
      </Text>
    ),
    subtitle: (appt) => (
      <Text size="xs" variant="muted">
        {appt.serviceTypeName ?? '—'} · {appt.durationMinutes} min
      </Text>
    ),
    badge: statusBadge,
    body: (appt) => (
      <>
        <Stack direction="row" align="center" justify="between" gap={2}>
          <Text size="sm" variant="muted">
            Account
          </Text>
          {accountCell(appt)}
        </Stack>
        <Stack direction="row" align="center" justify="between" gap={2}>
          <Text size="sm" variant="muted">
            Customer
          </Text>
          <Text size="sm" className="truncate">
            {appt.customerName ?? appt.customerEmail ?? '—'}
          </Text>
        </Stack>
        {vehicleLabel(appt.vehicleRef) ? (
          <Stack direction="row" align="center" justify="between" gap={2}>
            <Text size="sm" variant="muted">
              Vehicle
            </Text>
            <Text size="sm" className="truncate">
              {vehicleLabel(appt.vehicleRef)}
            </Text>
          </Stack>
        ) : null}
        <AppointmentActions appointment={appt} />
      </>
    ),
  };

  return (
    <SelectionList
      items={appointments}
      view={view}
      getId={(appt) => appt.id}
      selectable={false}
      entityLabelPlural="appointments"
      columns={columns}
      card={card}
    />
  );
}
