'use server';

import { api } from '@/lib/api-rest-client';

export async function approveOrder(orderId: string, reason?: string): Promise<{ error?: string }> {
  try {
    await api.post(`/v1/b2b/approval-queue/${orderId}/approve`, {
      reason: reason?.trim() || undefined,
    });
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Request failed' };
  }
}

export async function rejectOrder(orderId: string, reason?: string): Promise<{ error?: string }> {
  try {
    await api.post(`/v1/b2b/approval-queue/${orderId}/reject`, {
      reason: reason?.trim() || undefined,
    });
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Request failed' };
  }
}
