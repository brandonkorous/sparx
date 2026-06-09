'use server';

import { api } from '@/lib/api-rest-client';

interface PricingRule {
    type: string;
    value: number;
    roundTo?: string;
    maxMsrp?: string;
}

interface SupplierBody {
    name: string;
    type?: string;
    credentials: Record<string, string>;
    pricingRule: PricingRule | null;
    notes: string | null;
}

export async function createSupplier(body: SupplierBody): Promise<{ error?: string }> {
    try {
        await api.post('/v1/dropship/suppliers', body);
        return {};
    } catch (err) {
        return { error: err instanceof Error ? err.message : 'Create failed' };
    }
}

export async function updateSupplier(
    id: string,
    body: Omit<SupplierBody, 'type'>
): Promise<{ error?: string }> {
    try {
        await api.patch(`/v1/dropship/suppliers/${id}`, body);
        return {};
    } catch (err) {
        return { error: err instanceof Error ? err.message : 'Update failed' };
    }
}

export async function deleteSupplier(id: string): Promise<{ error?: string }> {
    try {
        await api.delete(`/v1/dropship/suppliers/${id}`);
        return {};
    } catch (err) {
        return { error: err instanceof Error ? err.message : 'Delete failed' };
    }
}

export async function syncSupplier(id: string): Promise<{ error?: string }> {
    try {
        await api.post(`/v1/dropship/suppliers/${id}/sync`, {});
        return {};
    } catch (err) {
        return { error: err instanceof Error ? err.message : 'Sync failed' };
    }
}
