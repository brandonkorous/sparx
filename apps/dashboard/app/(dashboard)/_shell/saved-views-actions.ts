'use server';

import { api } from '@/lib/api-rest-client';
import type { CreateSavedViewInput, SavedView } from '@/lib/saved-views';

// Server Actions wrapping the platform `/v1/views` API. The `api` client gates on
// the session and forwards the staff JWT, so tenant + user scoping happen
// server-side in api-rest (clients never pass identity). The "Views" control
// (a client component) calls these and re-reads the list on success — no
// revalidatePath, since the menu owns its own state.

export async function listSavedViewsAction(target: string): Promise<SavedView[]> {
  return api.get<SavedView[]>(`/v1/views?target=${encodeURIComponent(target)}`);
}

export async function createSavedViewAction(input: CreateSavedViewInput): Promise<SavedView> {
  return api.post<SavedView>('/v1/views', input);
}

export async function setDefaultSavedViewAction(id: string): Promise<SavedView> {
  return api.post<SavedView>(`/v1/views/${id}/default`);
}

export async function deleteSavedViewAction(id: string): Promise<void> {
  await api.delete(`/v1/views/${id}`);
}
