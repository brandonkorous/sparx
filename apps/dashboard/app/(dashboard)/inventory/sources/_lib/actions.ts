'use server';

import { api } from '@/lib/api-rest-client';

interface SourceBody {
    name: string;
    type?: string;
    config: Record<string, string>;
    syncIntervalSec: number;
    notes: string | null;
}

export async function createSource(body: SourceBody): Promise<{ error?: string }> {
    try {
        await api.post('/v1/inventory/sources', body);
        return {};
    } catch (err) {
        return { error: err instanceof Error ? err.message : 'Create failed' };
    }
}

export async function updateSource(
    id: string,
    body: Omit<SourceBody, 'type'>
): Promise<{ error?: string }> {
    try {
        await api.patch(`/v1/inventory/sources/${id}`, body);
        return {};
    } catch (err) {
        return { error: err instanceof Error ? err.message : 'Update failed' };
    }
}

export async function deleteSource(id: string): Promise<{ error?: string }> {
    try {
        await api.delete(`/v1/inventory/sources/${id}`);
        return {};
    } catch (err) {
        return { error: err instanceof Error ? err.message : 'Delete failed' };
    }
}

export async function syncSource(id: string): Promise<{ error?: string }> {
    try {
        await api.post(`/v1/inventory/sources/${id}/sync`);
        return {};
    } catch (err) {
        return { error: err instanceof Error ? err.message : 'Sync failed' };
    }
}
