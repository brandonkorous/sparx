import { moduleForActionType } from './actions';
import { moduleForScanEntity } from './schedule';
import { moduleForEventType } from './trigger-events';
import type { ModuleSlug } from './types';

interface ParsedTriggerLite {
  triggerType: string;
  triggerConfig: unknown;
}

/** The distinct parts of the business a rule touches (drops 'platform' — a wait
 *  or a webhook doesn't tag a module). Feeds the row's "Customers + Email" tags. */
export function deriveModules(
  trigger: ParsedTriggerLite,
  actions: readonly { type: string }[]
): ModuleSlug[] {
  const set = new Set<ModuleSlug>();
  if (trigger.triggerType.startsWith('schedule.')) {
    const cfg = (trigger.triggerConfig ?? {}) as { predicate?: { entity?: string } };
    if (cfg.predicate?.entity) set.add(moduleForScanEntity(cfg.predicate.entity));
  } else {
    set.add(moduleForEventType(trigger.triggerType));
  }
  for (const a of actions) set.add(moduleForActionType(a.type));
  set.delete('platform');
  return [...set];
}
