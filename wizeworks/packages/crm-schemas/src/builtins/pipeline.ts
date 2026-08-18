// Default sales pipeline template (docs/11 §4).
//
// Applied to every new tenant by the onboarding worker. Stages mirror the
// PRD's documented default; the tenant edits them freely once they have
// their own pipeline.

export interface PipelineStageTemplate {
  name: string;
  sortOrder: number;
  probability: number;
  // Widened for tickets (docs/144 §7.2) — `resolved`/`closed` are the service
  // vocabulary. Which of these a given template may use is narrowed per object
  // by `stageTypesFor` in ../common.
  stageType: 'open' | 'won' | 'lost' | 'resolved' | 'closed';
  color?: string;
}

export interface PipelineTemplate {
  name: string;
  slug: string;
  isDefault: boolean;
  /** What this process moves. Optional so the sales template — the only one
   *  that existed before pipelines became generic — reads unchanged. */
  objectKey?: string;
  stages: PipelineStageTemplate[];
}

export const DEFAULT_PIPELINE_TEMPLATE: PipelineTemplate = {
  name: 'Sales Pipeline',
  slug: 'sales',
  isDefault: true,
  objectKey: 'deal',
  stages: [
    { name: 'Lead', sortOrder: 0, probability: 10, stageType: 'open', color: '#94A3B8' },
    { name: 'Qualified', sortOrder: 1, probability: 25, stageType: 'open', color: '#06B6D4' },
    { name: 'Proposal Sent', sortOrder: 2, probability: 50, stageType: 'open', color: '#0EA5E9' },
    { name: 'Negotiation', sortOrder: 3, probability: 75, stageType: 'open', color: '#6366F1' },
    { name: 'Closed Won', sortOrder: 4, probability: 100, stageType: 'won', color: '#10B981' },
    { name: 'Closed Lost', sortOrder: 5, probability: 0, stageType: 'lost', color: '#EF4444' },
  ],
};
