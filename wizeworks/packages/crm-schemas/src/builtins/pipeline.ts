// Default sales pipeline template (docs/11 §4).
//
// Applied to every new tenant by the onboarding worker. The tenant edits them
// freely once they have their own pipeline.
//
// ── THE NAMES ARE THE OWNER'S, NOT A SALES TEAM'S ───────────────────────────
//
// These read Lead / Qualified / Proposal Sent / Negotiation / Closed Won /
// Closed Lost, which is the vocabulary of somebody who has worked in sales.
// The audience here is a person who makes clothes, or fixes engines, and the
// board is the first CRM screen they ever see. MEASURED 2026-09-25: all 43
// pipelines in the dev database still carried these words, and every one of
// them had `created_at = updated_at` — nobody had ever edited one, so nobody
// had translated them either.
//
// "Quote sent" in particular names a thing the platform already has: a quote
// is a real record with a number on it, so the stage points at something the
// owner can go and look at rather than at a stage of a process.
//
// WHAT NOT TO KEY OFF. `stageType` and `sortOrder` are the identity; the name
// is display. Five integration test files used to find a stage by its display
// name, which is why renaming these is a bigger job than it should be.
// [[feedback_copy_edit_breaks_identity_lookups]]

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
  name: 'Sales',
  slug: 'sales',
  isDefault: true,
  objectKey: 'deal',
  stages: [
    { name: 'New inquiry', sortOrder: 0, probability: 10, stageType: 'open', color: '#94A3B8' },
    { name: 'Worth pursuing', sortOrder: 1, probability: 25, stageType: 'open', color: '#06B6D4' },
    { name: 'Quote sent', sortOrder: 2, probability: 50, stageType: 'open', color: '#0EA5E9' },
    { name: 'Agreeing terms', sortOrder: 3, probability: 75, stageType: 'open', color: '#6366F1' },
    { name: 'Won', sortOrder: 4, probability: 100, stageType: 'won', color: '#10B981' },
    { name: 'Lost', sortOrder: 5, probability: 0, stageType: 'lost', color: '#EF4444' },
  ],
};
