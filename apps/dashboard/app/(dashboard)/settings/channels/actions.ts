'use server';

// Server actions for the Channels settings page. Tenant-scoped via the api-rest
// client (which forwards the session); the API gates on the Commerce module and
// role. The connect flow returns the channel's OAuth URL once an adapter ships;
// until then the API responds 409 and the action surfaces that message.

import 'server-only';
import { revalidatePath } from 'next/cache';
import { api } from '@/lib/api-rest-client';
import type { ActionResult, ChannelsPayload } from './_types';

export async function getChannels(): Promise<ChannelsPayload> {
  return api.get<ChannelsPayload>('/v1/channels');
}

export async function connectChannelAction(
  slug: string
): Promise<ActionResult<{ authUrl?: string }>> {
  try {
    const data = await api.post<{ authUrl?: string }>(`/v1/channels/${slug}/connect`);
    revalidatePath('/settings/channels');
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: { message: err instanceof Error ? err.message : String(err) } };
  }
}

export async function disconnectChannelAction(
  slug: string
): Promise<ActionResult<{ slug: string }>> {
  try {
    await api.delete(`/v1/channels/${slug}`);
    revalidatePath('/settings/channels');
    return { ok: true, data: { slug } };
  } catch (err) {
    return { ok: false, error: { message: err instanceof Error ? err.message : String(err) } };
  }
}
