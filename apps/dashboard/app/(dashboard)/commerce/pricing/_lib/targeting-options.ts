import { api } from '@/lib/api-rest-client';

// Bounded option lists for the price-list "targeting" picker (B2B account or
// customer segment — mutually exclusive, packages/commerce-schemas/src/pricing.ts).
// Shared by the create form (page + overlay) and the detail-page targeting
// editor so all three surfaces resolve the same options the same way.

export interface TargetOption {
  id: string;
  label: string;
}

interface B2bAccountLite {
  id: string;
  companyName: string;
}

interface SegmentLite {
  id: string;
  name: string;
}

export interface PriceListTargetingOptions {
  b2bAccounts: TargetOption[];
  segments: TargetOption[];
}

export async function loadPriceListTargetingOptions(): Promise<PriceListTargetingOptions> {
  const [b2bAccounts, segments] = await Promise.all([
    api
      .getPaged<B2bAccountLite[]>('/v1/crm/b2b-accounts?take=200')
      .then((r) => r.data)
      .catch(() => []),
    api
      .getPaged<SegmentLite[]>('/v1/crm/segments?take=200')
      .then((r) => r.data)
      .catch(() => []),
  ]);
  return {
    b2bAccounts: b2bAccounts.map((a) => ({ id: a.id, label: a.companyName })),
    segments: segments.map((s) => ({ id: s.id, label: s.name })),
  };
}
