'use server';

// Live Chat dashboard — server actions (docs/69 A-5).
//
// Sends + status changes go through api-rest (which persists + broadcasts over
// /ws/chat), so every connected staff socket — including the sender's other
// tabs — sees the update live. The socket is receive-only on the dashboard.

import { revalidatePath } from 'next/cache';

import { api } from '@/lib/api-rest-client';

import type { ChatMessageDto, ConversationStatus, ConversationSummaryDto } from './_lib/types';

export async function sendChatMessageAction(
  conversationId: string,
  body: string
): Promise<ChatMessageDto> {
  return api.post<ChatMessageDto>(`/v1/chat/conversations/${conversationId}/messages`, { body });
}

export async function setConversationStatusAction(
  conversationId: string,
  status: ConversationStatus
): Promise<ConversationSummaryDto> {
  const data = await api.patch<ConversationSummaryDto>(`/v1/chat/conversations/${conversationId}`, {
    status,
  });
  revalidatePath('/chat');
  return data;
}

export async function assignConversationAction(
  conversationId: string,
  assignedToId: string | null
): Promise<ConversationSummaryDto> {
  const data = await api.patch<ConversationSummaryDto>(`/v1/chat/conversations/${conversationId}`, {
    assignedToId,
  });
  revalidatePath('/chat');
  return data;
}

export async function markConversationReadAction(conversationId: string): Promise<void> {
  await api.post(`/v1/chat/conversations/${conversationId}/read`);
}
