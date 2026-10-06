// The automations builder vocabulary (triggers, condition operators, actions) in owner words.
// Event types and condition fields are free-text SUGGESTIONS, never an enum; only actions with
// a registered executor (`available: true`) are offered for a new step. Pure and client-safe.

/** What this console calls a part of the platform: ONE table, in `lib/surfaces/nav.ts`. A copy
 *  here drifted (`commerce` had six names across two consoles): one order reading four ways on
 *  four screens (issue 260), one level up. */
export { moduleLabel } from '../../../lib/surfaces/nav';

export type {
  ActionConfigField,
  ActionDef,
  ConditionOperatorDef,
  ConfigFieldType,
  ConfigOptionSource,
  ModuleSlug,
  ScanEntityDef,
  TriggerEventDef,
} from './types';
export { primitiveText } from './primitive-text';
export { TRIGGER_EVENTS, moduleForEventType } from './trigger-events';
export {
  DAYS_OF_WEEK,
  SCAN_ENTITIES,
  SCHEDULE_CADENCES,
  moduleForScanEntity,
  scanEntityLabel,
} from './schedule';
export { COMMON_CONDITION_FIELDS, CONDITION_OPERATORS, operatorDef } from './conditions';
export {
  ACTION_DEFS,
  actionDef,
  actionLabel,
  availableActions,
  moduleForActionType,
} from './actions';
export { deriveModules } from './derive-modules';
