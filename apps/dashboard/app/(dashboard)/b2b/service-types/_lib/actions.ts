'use server';

import { api } from '@/lib/api-rest-client';

interface ServiceTypeBody {
    name: string;
    description?: string;
    durationMinutes: number;
    color?: string;
    requiresVehicle: boolean;
    notes?: string;
}

interface ServiceTypePatch {
    name?: string;
    description?: string;
    durationMinutes?: number;
    color?: string;
    requiresVehicle?: boolean;
    notes?: string;
    isActive?: boolean;
}

export async function createServiceType(body: ServiceTypeBody): Promise<{ error?: string }> {
    try {
        await api.post('/v1/b2b/service-types', body);
        return {};
    } catch (err) {
        return { error: err instanceof Error ? err.message : 'Create failed' };
    }
}

export async function updateServiceType(
    id: string,
    body: ServiceTypePatch
): Promise<{ error?: string }> {
    try {
        await api.patch(`/v1/b2b/service-types/${id}`, body);
        return {};
    } catch (err) {
        return { error: err instanceof Error ? err.message : 'Update failed' };
    }
}

export async function deleteServiceType(id: string): Promise<{ error?: string }> {
    try {
        await api.delete(`/v1/b2b/service-types/${id}`);
        return {};
    } catch (err) {
        return { error: err instanceof Error ? err.message : 'Delete failed' };
    }
}
