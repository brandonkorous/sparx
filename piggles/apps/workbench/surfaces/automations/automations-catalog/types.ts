import type { ActionType, ConditionOperator } from '@wizeworks/automation-schemas';

/** The modules that contribute a trigger or an action (the module tags on a rule row). Hand-kept,
 *  NOT the platform-wide `ModuleSlug`: a module that GAINS a trigger must be added here, or
 *  TypeScript rejects its events in `TRIGGER_EVENTS` (as `staff` and `finance` once were). */
export type ModuleSlug =
  | 'crm'
  | 'email'
  | 'commerce'
  | 'b2b'
  | 'cms'
  | 'invoicing'
  | 'social'
  | 'staff'
  | 'finance'
  | 'dropship'
  | 'funnels'
  | 'platform';

export interface TriggerEventDef {
  eventType: string;
  label: string;
  module: ModuleSlug;
}

/** A scheduled trigger scans a kind of record on a timer; these are the kinds it
 *  can scan (the registered schedule scanners). */
export interface ScanEntityDef {
  entity: string;
  label: string;
  module: ModuleSlug;
}

export interface ConditionOperatorDef {
  value: ConditionOperator;
  label: string;
  /** Takes no right-hand value (a presence check). */
  valueless?: boolean;
  /** The value is a comma-separated list. */
  list?: boolean;
}

export type ConfigFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'tags'
  | 'email'
  | 'select'
  | 'json'
  /** Pick several from a list only the SERVER knows (e.g. a tenant's connected social
   *  accounts), named by {@link ActionConfigField.optionSource}. */
  | 'multiselect';

/** Where a `select`/`multiselect` gets its choices. One name per live-data list, so
 *  the form stays declarative and the fetching stays in one place. */
export type ConfigOptionSource = 'social-targets' | 'email-sequences';

export interface ActionConfigField {
  key: string;
  label: string;
  type: ConfigFieldType;
  required?: boolean;
  placeholder?: string;
  help?: string;
  options?: readonly { value: string; label: string }[];
  /** For a `multiselect` (pick several) or a `select` (pick one) — which live
   *  list to offer, when the choices only exist at runtime. */
  optionSource?: ConfigOptionSource;
  /** Shown in place of the list when the source has nothing to offer yet. */
  emptyHint?: string;
}

export interface ActionDef {
  type: ActionType;
  label: string;
  module: ModuleSlug;
  description: string;
  /** 'fields' → typed config form; 'json' → raw JSON (union/ID configs the UI
   *  can't safely pick); 'none' → no config; 'branch' → a question plus two
   *  nested step lists, which no key/value form can express (docs/144 §9). */
  mode: 'fields' | 'json' | 'none' | 'branch';
  /** Whether a runtime executor is registered — only available actions are
   *  offered for a NEW step. */
  available: boolean;
  configFields?: readonly ActionConfigField[];
  /** Seed shown in the JSON editor for a fresh 'json'-mode action. */
  jsonTemplate?: Record<string, unknown>;
}
