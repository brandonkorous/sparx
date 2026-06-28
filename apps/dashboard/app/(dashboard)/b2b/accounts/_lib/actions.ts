'use server';

import { api } from '@/lib/api-rest-client';

// A fleet vehicle as the dashboard sends it: a generalized fitment selection (a
// domain node + a value per range dimension), not a make/model/engine triple.
export interface FleetVehiclePayload {
  label: string;
  vin?: string;
  domainId: string;
  nodeId?: string | null;
  rangeValues?: { dimensionKey: string; value: number }[];
  mileage?: number;
  notes?: string;
  count: number;
}

export async function updateFleetVehicles(
  accountId: string,
  vehicles: FleetVehiclePayload[],
  fleetSize: number
): Promise<{ error?: string }> {
  try {
    await api.put(`/v1/b2b/accounts/${accountId}/fleet`, { vehicles, fleetSize });
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to save fleet' };
  }
}

export async function addApprovalRule(
  accountId: string,
  minAmountCents: number
): Promise<{ error?: string }> {
  try {
    await api.post('/v1/b2b/approval-rules', { accountId, minAmountCents });
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to add rule' };
  }
}

export async function deleteApprovalRule(ruleId: string): Promise<{ error?: string }> {
  try {
    await api.delete(`/v1/b2b/approval-rules/${ruleId}`);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to delete rule' };
  }
}

export async function updateAccountTier(
  accountId: string,
  pricingTierId: string | null
): Promise<{ error?: string }> {
  try {
    await api.patch(`/v1/b2b/accounts/${accountId}`, { pricingTierId });
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Update failed' };
  }
}

export async function deleteAccountOverride(
  accountId: string,
  overrideId: string
): Promise<{ error?: string }> {
  try {
    await api.delete(`/v1/b2b/accounts/${accountId}/overrides/${overrideId}`);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Delete failed' };
  }
}
