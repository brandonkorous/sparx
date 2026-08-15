'use client';

// ══════════════════════════════════════════════════════════════════════════
// CLICK TO CALL (docs/144 §5.6)
//
// sparx rings YOUR phone first, then dials the customer and joins the two. So
// the call happens on a real phone with a real signal, and the platform still
// knows who was called, when, and for how long — leaving only what was said for
// a person to type.
//
//   ['crm','calls',{…}]   calls on a record
//   ['crm','voice']       whether a phone system is connected at all
// ══════════════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from '@sparx/query';
import { ApiError } from '@sparx/api-client';
import { api } from '../../lib/api/client';

export interface CallRecord {
  id: string;
  customerId: string | null;
  dealId: string | null;
  direction: string;
  fromNumber: string;
  toNumber: string;
  startedAt: string;
  durationSec: number | null;
  status: string;
  outcome: string | null;
  notes: string | null;
  recordingUrl: string | null;
}

export interface VoiceConnection {
  id: string;
  provider: string;
  propertyId: string | null;
  accountSid: string;
  fromNumber: string;
  recordingEnabled: boolean;
  status: string;
  lastError: string | null;
}

export interface PlaceCallResult {
  call: CallRecord;
  placed: boolean;
  error?: string;
}

export interface ConnectPhoneSystemInput {
  provider: 'twilio';
  accountSid: string;
  authToken: string;
  fromNumber: string;
  /** Which site calls from this number. Null → every site that has none of its
   *  own, which is the right answer for a business with one phone line. */
  propertyId?: string | null;
  recordingEnabled?: boolean;
}

export const callKeys = {
  all: ['crm', 'calls'] as const,
  forRecord: (params: Record<string, unknown>) => [...callKeys.all, params] as const,
  voice: ['crm', 'voice'] as const,
};

/**
 * The phone the platform rings first, remembered between calls.
 *
 * Kept in the browser rather than on the user record on purpose: it is where
 * that PERSON is sitting right now, which changes between the office, a mobile
 * and home, and a stored value would confidently ring the wrong phone.
 */
const DEVICE_KEY = 'piggles.crm.callFrom';

export function rememberedDeviceNumber(): string {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(DEVICE_KEY) ?? '';
}

export function rememberDeviceNumber(value: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(DEVICE_KEY, value);
}

/** Whether this tenant can place calls at all. Drives whether the button is
 *  offered — an offered button that always fails is worse than no button. */
export function useVoiceConnections() {
  return useQuery({
    queryKey: callKeys.voice,
    queryFn: () => api.list<VoiceConnection>('/v1/crm/voice'),
    staleTime: 5 * 60_000,
    // A rep is not an admin and will get a 403 here; that is not an error worth
    // retrying or surfacing, it just means no click-to-call button for them.
    retry: false,
  });
}

export function useConnectPhoneSystem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ConnectPhoneSystemInput) =>
      api.post<VoiceConnection>('/v1/crm/voice', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: callKeys.voice });
    },
  });
}

export function useDisconnectPhoneSystem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/v1/crm/voice/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: callKeys.voice });
    },
  });
}

/* ── Presentation ───────────────────────────────────────────────────────── */

/** What a connection's state means, in a word a person can act on. */
export function voiceStatusTone(status: string): string {
  if (status === 'active') return 'success';
  if (status === 'expired') return 'danger';
  return 'warning';
}

export function voiceStatusLabel(status: string): string {
  if (status === 'active') return 'Working';
  if (status === 'expired') return 'Needs a new token';
  return 'Having trouble';
}

/** True when the deployment has no encryption key, so connecting is refused
 *  before a token is ever typed rather than after it is submitted. */
export function isVoiceSetupUnavailable(error: unknown): boolean {
  return (
    error instanceof ApiError && error.status === 400 && /not switched on/i.test(error.message)
  );
}

export function isVoiceForbidden(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403;
}

export function isModuleDisabled(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404 && /module/i.test(error.message);
}

export function useCallsFor(params: { customerId?: string; dealId?: string }) {
  const enabled = Boolean(params.customerId ?? params.dealId);
  return useQuery({
    queryKey: callKeys.forRecord(params),
    queryFn: () =>
      api.list<CallRecord>('/v1/crm/calls', {
        ...(params.customerId ? { customer_id: params.customerId } : {}),
        ...(params.dealId ? { deal_id: params.dealId } : {}),
      }),
    enabled,
  });
}

export function usePlaceCall() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { customerId: string; dealId?: string | null; fromDeviceNumber: string }) =>
      api.post<PlaceCallResult>('/v1/crm/calls', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: callKeys.all });
      void queryClient.invalidateQueries({ queryKey: ['crm', 'engagement'] });
      void queryClient.invalidateQueries({ queryKey: ['crm', 'activities'] });
    },
  });
}

export function callErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return error.message;
  }
  return fallback;
}
