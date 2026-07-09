'use client';

import Link from 'next/link';
import { type SelectionCard, type SelectionColumn, SelectionList } from '@sparx/ui';
import { Badge } from '@wizeworks/silicaui-react';

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

const STATUS_BADGE: Record<string, 'neutral' | 'info' | 'success' | 'warning' | 'danger'> = {
  requested: 'neutral',
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
        className="hover:text-module text-sm hover:underline"
      >
        {appt.companyName ?? appt.b2bAccountId}
      </Link>
    ) : (
      <p className="text-base-content/70 text-sm">—</p>
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
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium whitespace-nowrap tabular-nums">
            {formatDateTime(appt.scheduledAt)}
          </p>
          <p className="text-base-content/70 text-xs">{appt.durationMinutes} min</p>
        </div>
      ),
    },
    {
      header: 'Service',
      cell: (appt) => <p className="text-sm">{appt.serviceTypeName ?? '—'}</p>,
    },
    { header: 'Account', cell: accountCell },
    {
      header: 'Customer',
      cell: (appt) => (
        <div className="flex flex-col gap-1">
          <p className="text-sm">{appt.customerName ?? appt.customerEmail ?? '—'}</p>
          {appt.customerName && appt.customerEmail && (
            <p className="text-base-content/70 text-xs">{appt.customerEmail}</p>
          )}
        </div>
      ),
    },
    {
      header: 'Vehicle',
      cell: (appt) => (
        <p className="text-base-content/70 text-sm">{vehicleLabel(appt.vehicleRef) ?? '—'}</p>
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
      <p className="truncate text-sm font-medium whitespace-nowrap tabular-nums">
        {formatDateTime(appt.scheduledAt)}
      </p>
    ),
    subtitle: (appt) => (
      <p className="text-base-content/70 text-xs">
        {appt.serviceTypeName ?? '—'} · {appt.durationMinutes} min
      </p>
    ),
    badge: statusBadge,
    body: (appt) => (
      <>
        <div className="flex flex-row items-center justify-between gap-2">
          <p className="text-base-content/70 text-sm">Account</p>
          {accountCell(appt)}
        </div>
        <div className="flex flex-row items-center justify-between gap-2">
          <p className="text-base-content/70 text-sm">Customer</p>
          <p className="truncate text-sm">{appt.customerName ?? appt.customerEmail ?? '—'}</p>
        </div>
        {vehicleLabel(appt.vehicleRef) ? (
          <div className="flex flex-row items-center justify-between gap-2">
            <p className="text-base-content/70 text-sm">Vehicle</p>
            <p className="truncate text-sm">{vehicleLabel(appt.vehicleRef)}</p>
          </div>
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
