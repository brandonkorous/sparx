// What the plan form says about the parts, before anyone plans.
//
// A run could be planned for something the shelf cannot build. The recipe page
// knew ("You could make 0"), the plan form said nothing, and the owner found out
// only on "Hold the parts", from a refusal naming a part by its code
// (sparx persona issue 317). Planning is still allowed: a run on paper is how
// parts get scheduled. It just says so first.

import type { Buildable } from './assembly-data';

export interface PlanRunNote {
  short: boolean;
  text: string;
}

const count = (n: number): string => n.toLocaleString('en-US');

export function planRunNote(
  buildable: Buildable | undefined,
  requested: number,
  place: string
): PlanRunNote | null {
  if (!buildable || !Number.isFinite(requested) || requested < 1) return null;
  const can = buildable.quantity;
  if (requested <= can) {
    return { short: false, text: `Up to ${count(can)} can be made at ${place} from what is free.` };
  }
  const limiting = buildable.components.find((c) => c.isLimiting);
  const name = limiting?.productTitle ?? limiting?.variantSku ?? buildable.limitingSku;
  const first = name ? `: ${name} runs out first` : '';
  const lead = can > 0 ? `Only ${count(can)} can be made` : 'None can be made';
  return {
    short: true,
    text: `${lead} at ${place} from what is free${first}. You can still plan it, and hold the parts once they are in.`,
  };
}
