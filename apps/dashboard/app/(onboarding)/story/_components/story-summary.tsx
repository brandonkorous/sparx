'use client';

import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { MODULE_BY_KEY, moduleBilled, moduleElsewhere, moduleLock } from '@/lib/modules';
import type { SummaryPlanItem } from '../../onboarding/_components/summary-card';
import { industryOf } from '../_lib/clauses';
import type { WizardBlueprint } from '../../onboarding/_lib/types';
import {
  directlyNamed,
  enabledModuleKeys,
  fulfillment,
  handleSlug,
  pickBlueprint,
  pulledBy,
  resolveModules,
  type StoryState,
} from '../_lib/story-state';

const SELLING = ['commerce', 'b2b', 'dropship'];
const FULFILMENT_TAGS: { key: string; label: string }[] = [
  { key: 'ship', label: 'Shipping' },
  { key: 'pickup', label: 'Local pickup' },
  { key: 'delivery', label: 'Local delivery' },
];

/** The module rows the SummaryCard renders for a story — each with its real price /
 *  "Included" state and an optional "comes with X" caption for narrative-pulled deps. */
export function storyPlanItems(story: StoryState): SummaryPlanItem[] {
  const on = resolveModules(story);
  return enabledModuleKeys(story).flatMap((k) => {
    const m = MODULE_BY_KEY[k];
    if (!m) return [];
    const pulled = !directlyNamed(story, k) ? pulledBy(story, k) : null;
    return [
      {
        key: k,
        name: m.name,
        price: moduleBilled(on, m),
        included: moduleLock(on, k) === 'included',
        colorVar: m.colorVar,
        caption: pulled ? `comes with ${pulled}` : undefined,
      },
    ];
  });
}

export function storyTotals(story: StoryState): { total: number; elsewhere: number } {
  const on = resolveModules(story);
  let total = 0;
  let elsewhere = 0;
  for (const k of enabledModuleKeys(story)) {
    const m = MODULE_BY_KEY[k];
    if (!m) continue;
    total += moduleBilled(on, m);
    elsewhere += moduleElsewhere(on, m);
  }
  return { total, elsewhere };
}

function Section({ label, children }: { label: string; children: ReactNode }): ReactNode {
  return (
    <div className="border-base-300 border-t px-6 py-4">
      <div className="text-base-content mb-2 text-[11px] font-medium tracking-wide">{label}</div>
      {children}
    </div>
  );
}

/** The story's rich summary sections (starting point, web address, fulfillment,
 *  getting paid) injected into the shared SummaryCard's `extras` slot. */
export function StoryExtras({
  story,
  blueprints,
}: {
  story: StoryState;
  blueprints: WizardBlueprint[];
}): ReactNode {
  const on = resolveModules(story);
  const blueprint = pickBlueprint(
    story.industry ? industryOf(story.industry) : null,
    on,
    blueprints
  );
  const ful = fulfillment(story);
  const slug = handleSlug(story.name) || 'your-name';
  const selling = SELLING.some((k) => on[k]);

  return (
    <>
      <Section label="Your starting point">
        {blueprint ? (
          <div>
            <div className="text-base-content text-sm font-medium">{blueprint.name}</div>
            <div className="text-base-content text-[13px]">{blueprint.summary}</div>
          </div>
        ) : (
          <div className="text-base-content text-[13px]">
            A blank Builder site — yours to design from scratch.
          </div>
        )}
      </Section>

      <Section label="Your web address">
        <div className="flex items-center gap-2">
          <span className="text-base-content font-mono text-sm font-medium">{slug}.sparx.zone</span>
          <span className="text-success ml-auto inline-flex items-center gap-1 text-xs">
            <Check className="h-3 w-3" /> free
          </span>
        </div>
        {on.commerce && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {FULFILMENT_TAGS.map((t) => {
              const active = ful.has(t.key);
              return (
                <span
                  key={t.key}
                  className="rounded-full border px-2.5 py-0.5 text-[11.5px] font-medium"
                  style={
                    active
                      ? {
                          borderColor: 'var(--color-module-commerce)',
                          color: 'var(--color-module-commerce)',
                        }
                      : {
                          borderColor: 'var(--color-base-300)',
                          color: 'color-mix(in oklch, var(--color-base-content) 50%, transparent)',
                        }
                  }
                >
                  {t.label}
                </span>
              );
            })}
          </div>
        )}
      </Section>

      {selling && (
        <Section label="Getting paid">
          <div className="text-base-content text-[13px]">
            Connect <span className="text-base-content font-medium">Stripe</span> to take payments —
            the next beat after you build.
          </div>
        </Section>
      )}
    </>
  );
}
