import { productCopy } from '../../../lib/product';
import type { WorkbenchModule } from '../../../components/module-scope';
import type { Automation } from '../automations-data';
import { parseActions } from '../automations-presentation';
import { deriveModules } from '../automations-catalog';
import { GOAL_GROUPS, goalGroup, type GoalKey, type RecipeMeta } from '../recipes-catalog';

/** on = active or errored (an errored rule is still switched on); off = paused or draft. The
 *  card's badge reads the run counters, since nothing ever writes `error` (issue 540: 2,411
 *  automations, zero). [[feedback_screen_over_a_function_nobody_calls]] */
export function isOn(status: Automation['status']): boolean {
  return status === 'active' || status === 'error';
}

/** The presentation for an automation with no curated recipe: its own name and
 *  server-set description, its module derived from what it actually touches, and
 *  the "More" goal. Keeps a freshly-seeded automation visible and honest. */
export function fallbackMeta(automation: Automation): RecipeMeta {
  const modules = deriveModules(
    { triggerType: automation.triggerType, triggerConfig: automation.triggerConfig },
    parseActions(automation.actions)
  );
  return {
    name: automation.name,
    goal: 'more',
    title: automation.name,
    blurb:
      automation.description ??
      productCopy('automations.recipe.byPlatform.detail', 'An automation sparx set up for you.'),
    icon: goalGroup('more').icon,
    module: (modules[0] as WorkbenchModule | undefined) ?? 'automations',
  };
}

export interface Joined {
  automation: Automation;
  meta: RecipeMeta;
}

/** The recipes the state filter and search let through. */
export function filterRecipes(joined: Joined[], needle: string, state: string) {
  return joined.filter(({ automation, meta }) => {
    if (state === 'on' && !isOn(automation.status)) return false;
    if (state === 'off' && isOn(automation.status)) return false;
    if (state === 'error' && automation.status !== 'error') return false;
    if (!needle) return true;
    return (
      meta.title.toLowerCase().includes(needle) ||
      meta.blurb.toLowerCase().includes(needle) ||
      automation.name.toLowerCase().includes(needle)
    );
  });
}

// Group the visible recipes by goal, in the catalog's goal order, dropping any
// group with nothing to show.
export function groupByGoal(filtered: Joined[]) {
  const byGoal = new Map<GoalKey, Joined[]>();
  for (const entry of filtered) {
    const list = byGoal.get(entry.meta.goal) ?? [];
    list.push(entry);
    byGoal.set(entry.meta.goal, list);
  }
  return GOAL_GROUPS.map((group) => ({ group, items: byGoal.get(group.key) ?? [] })).filter(
    (section) => section.items.length > 0
  );
}
