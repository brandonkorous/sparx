'use server';

// Live Chat settings — server actions (docs/69 A-5).

import { revalidatePath } from 'next/cache';

import { api } from '@/lib/api-rest-client';

import type { ChatConfig, ChatConfigPatch, QuickReplyDto } from './_lib/types';

export async function updateChatSettingsAction(patch: ChatConfigPatch): Promise<ChatConfig> {
  const data = await api.patch<ChatConfig>('/v1/chat/settings', patch);
  revalidatePath('/settings/chat');
  return data;
}

export async function createQuickReplyAction(input: {
  title: string;
  body: string;
  shortcut?: string;
}): Promise<QuickReplyDto> {
  const data = await api.post<QuickReplyDto>('/v1/chat/quick-replies', input);
  revalidatePath('/settings/chat');
  return data;
}

export async function deleteQuickReplyAction(id: string): Promise<void> {
  await api.delete(`/v1/chat/quick-replies/${id}`);
  revalidatePath('/settings/chat');
}
