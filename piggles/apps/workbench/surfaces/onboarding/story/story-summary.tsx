'use client';

import type { ReactNode } from 'react';
import { Badge, Text } from '@wizeworks/silicaui-react';
import { faCheck } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { industryOf } from '@wizeworks/story-schemas';
import { ModuleScope } from '../../../components/module-scope';
import { MODULE_BY_KEY } from '../../../lib/onboarding/modules';
import type { SummaryPlanItem } from '../../../lib/onboarding/summary-card';
import type { WizardBlueprint } from '../../../lib/onboarding/types';
import {
  enabledModuleKeys,
  fulfillment,
  handleSlug,
  pickBlueprint,
  resolveModules,
  type StoryState,
} from '../../../lib/onboarding/story-state';
import { PRODUCT } from '@piggles/config';

const SELLING = ['commerce', 'b2b', 'dropship'];
const FULFILMENT_TAGS: { key: string; label: string }[] = [
  { key: 'ship', label: 'Shipping' },
  { key: 'pickup', label: 'Local pickup' },
  { key: 'delivery', label: 'Local delivery' },
];

/** The app rows the SummaryCard renders for a story, in enabled order. Names
 *  only — there is no per-app price to carry (RULE #2). */
export function storyPlanItems(story: StoryState): SummaryPlanItem[] {
  return enabledModuleKeys(story).flatMap((k) => {
    const m = MODULE_BY_KEY[k];
    return m ? [{ key: k, name: m.name }] : [];
  });
}

function Section({ label, children }: { label: string; children: ReactNode }): ReactNode {
  return (
    <div className="border-base-300 flex flex-col gap-2 border-t pt-4">
      <Text className="text-sm font-medium">{label}</Text>
      {children}
    </div>
  );
}

/** The story's rich summary sections (starting point, web address, fulfillment,
 *  getting paid), injected into the shared SummaryCard's `extras` slot. */
export function StoryExtras({
  story,
  blueprints,
  blueprintOverride,
}: {
  story: StoryState;
  blueprints: WizardBlueprint[];
  /** Force the "starting point" instead of auto-picking: a blueprint, or null for a
   *  blank Builder site. `undefined` (the default) keeps the story's auto-pick, so the
   *  story and the wizard's pre-template steps show the same match. */
  blueprintOverride?: WizardBlueprint | null;
}): ReactNode {
  const on = resolveModules(story);
  const blueprint =
    blueprintOverride !== undefined
      ? blueprintOverride
      : pickBlueprint(story.industry ? industryOf(story.industry) : null, on, blueprints);
  const ful = fulfillment(story);
  const slug = handleSlug(story.name) || 'your-name';
  const selling = SELLING.some((k) => on[k]);

  return (
    <>
      <Section label="Your starting point">
        {blueprint ? (
          <div className="flex flex-col gap-0.5">
            <Text className="font-medium">{blueprint.name}</Text>
            <Text className="text-sm">{blueprint.summary}</Text>
          </div>
        ) : (
          <Text className="text-sm">A blank Builder site — yours to design from scratch.</Text>
        )}
      </Section>

      <Section label="Your web address">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-medium">
            {slug}.{PRODUCT.tenantSites.suffix}
          </span>
          <span className="ml-auto">
            <Badge color="success" variant="soft" size="sm">
              <Icon glyph={faCheck} className="size-3" aria-hidden /> free
            </Badge>
          </span>
        </div>
        {on.commerce ? (
          <ModuleScope module="commerce" className="mt-1 flex flex-wrap gap-1.5">
            {FULFILMENT_TAGS.map((t) =>
              ful.has(t.key) ? (
                <Badge key={t.key} color="module" variant="soft" size="sm">
                  {t.label}
                </Badge>
              ) : (
                <Badge key={t.key} color="neutral" variant="outline" size="sm">
                  {t.label}
                </Badge>
              )
            )}
          </ModuleScope>
        ) : null}
      </Section>

      {selling ? (
        <Section label="Getting paid">
          <Text className="text-sm">
            Connect <span className="font-medium">Stripe</span> to take payments — the next beat
            after you build.
          </Text>
        </Section>
      ) : null}
    </>
  );
}
