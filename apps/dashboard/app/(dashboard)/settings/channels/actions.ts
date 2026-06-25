'use server';

// Server actions for the Channels settings page. Tenant-scoped via the api-rest
// client (which forwards the session); the API gates on the Commerce module and
// role. Connect mirrors the Search Console flow: fetch the channel's signed-state
// OAuth URL (with the dashboard callback as redirect_uri) and let the client send
// the browser there; the callback route completes the exchange.

import 'server-only';
import { revalidatePath } from 'next/cache';
import { api } from '@/lib/api-rest-client';
import type { ActionResult, ChannelsPayload } from './_types';

const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL ?? '';
const CALLBACK_PATH = '/settings/channels/callback';

export async function getChannels(): Promise<ChannelsPayload> {
  return api.get<ChannelsPayload>('/v1/channels');
}

export async function connectChannelAction(slug: string): Promise<ActionResult<{ url: string }>> {
  try {
    const callbackUrl = `${DASHBOARD_URL}${CALLBACK_PATH}`;
    const data = await api.get<{ url: string }>(
      `/v1/channels/${slug}/connect-url?redirect_uri=${encodeURIComponent(callbackUrl)}`
    );
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
