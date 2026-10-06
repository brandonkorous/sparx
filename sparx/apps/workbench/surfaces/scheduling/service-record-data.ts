'use client';

// The data layer of a fleet SERVICE RECORD (sparx persona issue 086): which trade
// account and vehicle a booking was for, the parts from that account's orders
// that went into it, and an account's visits for the account pane.
//
//   ['scheduling','bookings', id, 'service-record', {q}]   one booking's record + choices
//   ['scheduling','fleet-history', companyId]               an account's visits
//
// Writes refresh the booking root (the booking's own row and history change) and
// the account's visits.

import { useMutation, useQuery, useQueryClient } from '@wizeworks/query';
import { api } from '../../lib/api/client';
import { bookingKeys } from './bookings-data';
import type { ServiceRecordPart } from './service-record-words';

export interface VehicleSnapshot {
  vehicleId: string;
  name: string | null;
  label: string;
  description: string | null;
  vin: string | null;
}

export interface FleetChoice {
  id: string;
  label: string;
  vin: string | null;
}

export interface LinkableOrderLine {
  id: string;
  variantId: string | null;
  productId: string | null;
  sku: string;
  name: string;
  quantity: number;
}

export interface LinkableOrder {
  id: string;
  orderNumber: string;
  status: string;
  placedAt: string;
  items: LinkableOrderLine[];
}

/** One booking as a service record, with the choices for its vehicle and parts. */
export interface BookingServiceRecord {
  company: { id: string; companyName: string } | null;
  vehicle: VehicleSnapshot | null;
  parts: ServiceRecordPart[];
  /** Trade accounts the booked person buys for: the choices when the booking has
   *  no account yet. */
  accounts: { id: string; companyName: string }[];
  /** The account's fleet. */
  vehicles: FleetChoice[];
  /** The account's newest orders, with their lines. */
  orders: LinkableOrder[];
}

export interface ServiceVisit {
  id: string;
  serviceName: string;
  status: string;
  startAt: string;
  endAt: string;
  timezone: string;
  notes: string | null;
  staffNotes?: string | null;
  vehicle: VehicleSnapshot | null;
  parts: ServiceRecordPart[];
}

export type AccountServiceHistory = { enabled: false } | { enabled: true; records: ServiceVisit[] };

export const serviceRecordKeys = {
  record: (bookingId: string, q: string) =>
    [...bookingKeys.detail(bookingId), 'service-record', { q }] as const,
  history: (companyId: string) => ['scheduling', 'fleet-history', companyId] as const,
  historyRoot: ['scheduling', 'fleet-history'] as const,
};

export function useBookingServiceRecord(bookingId: string, q: string) {
  return useQuery({
    queryKey: serviceRecordKeys.record(bookingId, q),
    queryFn: () =>
      api.get<BookingServiceRecord>(
        `/v1/scheduling/bookings/${bookingId}/service-record`,
        q ? { q } : undefined
      ),
    placeholderData: (previous) => previous,
  });
}

export function useAccountServiceHistory(companyId: string) {
  return useQuery({
    queryKey: serviceRecordKeys.history(companyId),
    queryFn: () =>
      api.get<AccountServiceHistory>(`/v1/scheduling/fleet/accounts/${companyId}/service-history`),
  });
}

function useRefreshServiceRecords(bookingId: string) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: bookingKeys.all });
    void queryClient.invalidateQueries({ queryKey: bookingKeys.detail(bookingId) });
    void queryClient.invalidateQueries({ queryKey: serviceRecordKeys.historyRoot });
  };
}

export function useSetBookingVehicle(bookingId: string) {
  const refresh = useRefreshServiceRecords(bookingId);
  return useMutation({
    mutationFn: (input: { companyId: string | null; vehicleId: string | null }) =>
      api.put<{ companyId: string | null; vehicle: VehicleSnapshot | null }>(
        `/v1/scheduling/bookings/${bookingId}/vehicle`,
        input
      ),
    onSuccess: refresh,
  });
}

export function useSetBookingParts(bookingId: string) {
  const refresh = useRefreshServiceRecords(bookingId);
  return useMutation({
    mutationFn: (parts: { orderItemId: string; quantity: number }[]) =>
      api.put<{ parts: ServiceRecordPart[] }>(`/v1/scheduling/bookings/${bookingId}/parts`, {
        parts,
      }),
    onSuccess: refresh,
  });
}
