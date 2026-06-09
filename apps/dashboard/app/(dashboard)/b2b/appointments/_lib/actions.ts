'use server';

import { api } from '@/lib/api-rest-client';

type AppointmentAction = 'confirm' | 'complete' | 'cancel';

export async function performAppointmentAction(
  id: string,
  action: AppointmentAction,
  reason?: string
): Promise<{ error?: string }> {
  try {
    await api.post(`/v1/b2b/appointments/${id}/${action}`, {
      ...(action === 'cancel' ? { reason: reason?.trim() || undefined } : {}),
    });
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Request failed' };
  }
}
