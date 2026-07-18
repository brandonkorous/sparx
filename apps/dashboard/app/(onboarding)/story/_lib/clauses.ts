// The clause catalog now lives in `@sparx/story-schemas` — the story grammar is
// shared with the marketing hero (apps/web), which renders the same example stories
// read-only, so the homepage can never drift from what onboarding actually opens
// with. This module stays as the composer's local door onto that vocabulary.

export {
  CLAUSE,
  MOVEMENTS,
  ALL_CLAUSE_IDS,
  TENSE,
  TENSE_ORDER,
  AUDIENCE,
  AUDIENCE_ORDER,
  NARRATIVE_REQ,
  GENERIC_INDUSTRY,
  INDUSTRIES,
  INDUSTRY_BY_SLUG,
  industryOf,
} from '@sparx/story-schemas';

export type {
  Clause,
  ClauseVoice,
  Fulfillment,
  BlueprintVertical,
  Industry,
  TenseKey,
  AudienceKey,
} from '@sparx/story-schemas';
