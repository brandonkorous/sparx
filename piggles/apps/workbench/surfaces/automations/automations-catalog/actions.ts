import { B2B_ACTION_DEFS } from './action-defs-b2b';
import { COMMERCE_ACTION_DEFS } from './action-defs-commerce';
import { CRM_ACTION_DEFS } from './action-defs-crm';
import { CRM_WORKFLOW_ACTION_DEFS } from './action-defs-crm-workflow';
import { MESSAGE_ACTION_DEFS } from './action-defs-messages';
import { PLATFORM_ACTION_DEFS } from './action-defs-platform';
import { SOCIAL_ACTION_DEFS } from './action-defs-social';
import type { ActionDef, ModuleSlug } from './types';

export const ACTION_DEFS: readonly ActionDef[] = [
  ...PLATFORM_ACTION_DEFS,
  ...CRM_ACTION_DEFS,
  ...CRM_WORKFLOW_ACTION_DEFS,
  ...MESSAGE_ACTION_DEFS,
  ...B2B_ACTION_DEFS,
  ...SOCIAL_ACTION_DEFS,
  ...COMMERCE_ACTION_DEFS,
];

export function actionDef(type: string): ActionDef | undefined {
  return ACTION_DEFS.find((a) => a.type === type);
}

export function actionLabel(type: string): string {
  return actionDef(type)?.label ?? type;
}

export function moduleForActionType(type: string): ModuleSlug {
  const head = type.split('.')[0] ?? '';
  if (head === 'form') return 'cms';
  if (head === 'inventory') return 'commerce';
  const def = actionDef(type);
  if (def) return def.module;
  return (head as ModuleSlug) || 'platform';
}

/** Actions offerable for a NEW step: has an executor, and its module is active
 *  (platform actions are always offered). */
export function availableActions(enabledModules: readonly string[]): ActionDef[] {
  const active = new Set(enabledModules);
  return ACTION_DEFS.filter(
    (a) => a.available && (a.module === 'platform' || active.has(a.module))
  );
}
