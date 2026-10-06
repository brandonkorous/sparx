import type {
  Action,
  AutomationDraft,
  AutomationOrigin,
  AutomationStatus,
  ConditionGroup,
  Trigger,
} from '@wizeworks/automation-schemas';

/* ── Semantic tone (shared with the Badge/Button color axis) ────────────── */

/** `module` is the active module's own hue — reserved for the ONE state that is
 *  better than plain success (a run that met the rule's goal), so it does not
 *  share green with "ran to the end and nothing happened". */
export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'module';

/* ── The automation rule (the raw wire row, dates as ISO strings) ────────── */

/** One rule as `GET /v1/automations/:id` returns it: the live PUBLISHED document plus a staged
 *  `draft`. The JSON sub-parts are `unknown` on the wire and parsed with the canonical
 *  `@wizeworks/automation-schemas` parsers in presentation.tsx, never trusted raw. */
export interface Automation {
  id: string;
  tenantId: string;
  /** The site this rule acts on. Null = tenant-wide (runs on every site). */
  propertyId: string | null;
  name: string;
  description: string | null;
  status: AutomationStatus;
  triggerType: string;
  triggerConfig: unknown;
  conditions: unknown;
  actions: unknown;
  /** What this rule is aiming to cause (docs/144 §9); null = no goal. */
  goal: unknown;
  /** The live published version number (1 on create). */
  version: number;
  publishedAt: string | null;
  publishedBy: string | null;
  /** The staged, unpublished edit — null when there is nothing to publish. */
  draft: AutomationDraft | null;
  aiGenerated: boolean;
  aiPrompt: string | null;
  /** user = the tenant made it; system = platform-seeded. */
  origin: AutomationOrigin;
  /** Locked = platform-managed; rejects edit/status/delete. */
  locked: boolean;
  /** The permanent identity of a rule we set up; null on the business's own. */
  systemKey: string | null;
  /** When we had a newer version of a rule we set up and held it back, because
   *  the business had changed theirs. Null = nothing waiting. */
  platformUpdateAt: string | null;
  /** That newer version, kept beside the flag so it can be compared and taken. */
  platformDocument: PlatformDocument | null;
  clonedFrom: string | null;
  maxDepth: number;
  runCount: number;
  errorCount: number;
  lastRunAt: string | null;
  lastErrorAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Our newer version of a rule we set up: the rule without its name, which stays
 *  the business's. Same column shapes as the live rule. */
export interface PlatformDocument {
  description: string | null;
  triggerType: string;
  triggerConfig: unknown;
  conditions: unknown;
  actions: unknown;
  goal: unknown;
  maxDepth: number;
}

/** One immutable published-version snapshot, as `/versions` returns it. */
export interface AutomationVersionRow {
  id: string;
  automationId: string;
  tenantId: string;
  version: number;
  name: string;
  description: string | null;
  triggerType: string;
  triggerConfig: unknown;
  conditions: unknown;
  actions: unknown;
  goal: unknown;
  maxDepth: number;
  note: string | null;
  publishedAt: string;
  publishedBy: string | null;
}

/* ── Filters ────────────────────────────────────────────────────────────── */

export interface AutomationsFilter {
  /** draft | active | paused | error, or 'all'. */
  status?: string;
  /** 'user' | 'system', or 'all'. */
  origin?: string;
}

export interface RunsFilter {
  status?: string;
  limit?: number;
}

/* ── Write inputs ───────────────────────────────────────────────────────── */

export interface AutomationCreateInput {
  name: string;
  description?: string | null;
  propertyId?: string | null;
  trigger: Trigger;
  conditions: ConditionGroup;
  actions: Action[];
  goal?: ConditionGroup | null;
  maxDepth: number;
}

export interface AutomationUpdateInput {
  name?: string;
  description?: string | null;
  propertyId?: string | null;
  trigger?: Trigger;
  conditions?: ConditionGroup;
  actions?: Action[];
  goal?: ConditionGroup | null;
  maxDepth?: number;
}
