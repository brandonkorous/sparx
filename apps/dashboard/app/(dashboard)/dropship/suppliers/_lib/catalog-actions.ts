'use server';

import { api } from '@/lib/api-rest-client';

export async function importSupplierProduct(
    supplierId: string,
    productId: string
): Promise<{ error?: string }> {
    try {
        await api.post(`/v1/dropship/suppliers/${supplierId}/catalog/${productId}/import`, {});
        return {};
    } catch (err) {
        return { error: err instanceof Error ? err.message : 'Import failed' };
    }
}
