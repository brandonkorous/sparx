import 'server-only';

// Server-side loader for the customer wizard's optional "Opportunity" step.
// Fetches the tenant's CRM pipelines (with their ordered stages) and maps them
// to the minimal shape the client wizard needs to offer pipeline → stage
// selection. Both the full-page `/new` route and the drawer/modal overlay
// (detail-slot) call this so the deal card behaves identically in either
// presentation. Returns `[]` if the fetch fails — the deal card then degrades
// to a "create a pipeline first" hint instead of erroring the whole wizard.

import { api } from '@/lib/api-rest-client';
import type { PipelineOption } from './customer-full-profile-wizard';

interface RawStage {
  id: string;
  name: string;
  probability: number;
}

interface RawPipeline {
  id: string;
  name: string;
  stages: RawStage[];
}

export async function loadPipelineOptions(): Promise<PipelineOption[]> {
  try {
    const rows = await api.get<RawPipeline[]>('/v1/crm/pipelines');
    return rows.map((p) => ({
      id: p.id,
      name: p.name,
      stages: p.stages.map((s) => ({ id: s.id, name: s.name, probability: s.probability })),
    }));
  } catch {
    return [];
  }
}
