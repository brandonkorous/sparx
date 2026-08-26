// Wire shapes for /v1/funnels.
//
// Every count and every rate is `number | null`, and null is NEVER 0: null means
// nobody can say, and drawing it as 0% tells an owner their campaign failed when
// it simply has not been measured.

export type FunnelStatus = 'draft' | 'active' | 'paused' | 'archived';
export type FunnelKind = 'lead' | 'recovery' | 'purchase' | 'booking' | 'winback' | 'custom';

/** What a step DOES. `view` is the only one counted anonymously. */
export type StageKind = 'view' | 'capture' | 'qualify' | 'engage' | 'convert';

/** One step. `key` is the identity history is recorded against, so renaming
 *  `name` never orphans past results. */
export interface FunnelStage {
  key: string;
  name: string;
  kind: StageKind;
  /** Which page counts as this step. `view` steps only. */
  path?: string;
}

export interface Funnel {
  id: string;
  propertyId: string;
  name: string;
  description: string | null;
  status: FunnelStatus;
  kind: FunnelKind;
  stages: FunnelStage[];
  goal: unknown;
  goalValueCents: string | number | null;
  automationId: string | null;
  sequenceId: string | null;
  entryPageId: string | null;
  entryFormNodeId: string | null;
  stallAfterHours: number | null;
  recipeKey: string | null;
  createdAt: string;
  updatedAt: string;
}

/** One step, with its numbers. See the null rule at the top of this file. */
export interface LadderRung {
  key: string;
  name: string;
  kind: StageKind;
  entered: number | null;
  conversionFromPrevious: number | null;
  conversionFromEntry: number | null;
  valueCents: number;
  path: string | null;
}

export interface Ladder {
  funnelId: string;
  from: string;
  to: string;
  rungs: LadderRung[];
  valueCents: number;
  overallRate: number | null;
}

export interface CreateFunnelBody {
  propertyId: string;
  name: string;
  kind: FunnelKind;
  description?: string;
}

export type UpdateFunnelBody = Partial<{
  name: string;
  description: string | null;
  status: FunnelStatus;
  stages: FunnelStage[];
  goal: unknown;
  goalValueCents: number | null;
  entryPageId: string | null;
  entryFormNodeId: string | null;
  stallAfterHours: number | null;
}>;
