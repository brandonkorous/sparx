'use client';

// The design she started from has been refreshed since she used it.
//
// Blueprint content is COPIED into a site at install, so a fix to the catalog
// never reaches a site already built from it. The three-way merge that applies
// one has existed all along (docs/55) — what was missing is anybody being told
// there is one, which meant the fix and the bakery never met.
//
// It goes on Home rather than in "What needs you": nothing is waiting on her,
// nothing is late, and folding it in would put it in the quiet line as one more
// thing to be reassured about. This is an offer, and it says so.

import {
  Alert,
  AlertActions,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Button,
} from '@wizeworks/silicaui-react';
import { ModuleScope } from '@/components/module-scope';
import type { SurfaceContext } from '@/lib/surfaces/registry';
import { useBlueprints, type Blueprint } from '../builder/blueprints-data';
import { useUpdatePlan } from '../builder/blueprints-update';

/** What is in the newer version, in her words, or nothing at all when the plan
 *  has not arrived. A count nobody has measured must never render as one. */
function whatChanges(plan: { summary: { new: number; updated: number } } | undefined): string {
  if (!plan) return '';
  const { new: added, updated } = plan.summary;
  const bits: string[] = [];
  if (updated > 0) bits.push(`${String(updated)} ${updated === 1 ? 'thing' : 'things'} refreshed`);
  if (added > 0) bits.push(`${String(added)} ${added === 1 ? 'piece' : 'pieces'} added`);
  return bits.length ? `: ${bits.join(' and ')}` : '';
}

function UpdateOffer({ blueprint, ctx }: { blueprint: Blueprint; ctx: SurfaceContext }) {
  const install = blueprint.install;
  // Read-only; the plan writes nothing. Only fetched once we know there is one.
  const { data: plan } = useUpdatePlan(install?.id ?? '', Boolean(install?.update_available));

  return (
    <ModuleScope module="builder">
      {/* Solid at 16px: measured on her Home, `alert-soft` puts this ink at
          2.17:1 and solid at 6.35:1 (issue 076). The button wears no color —
          the alert already has the hue, and repeating it hides the button. */}
      {/* Stacked until the pane is wide enough for both. `.alert` is a flex row
          that never wraps and its message column may shrink to nothing, so at
          360px the title set one word per line (issue 258). */}
      <Alert color="module" className="mt-6 flex-col text-base @[34rem]:flex-row">
        <AlertContent>
          <AlertTitle>The design your site was built from has been refreshed</AlertTitle>
          <AlertDescription>
            You started from <strong>{blueprint.name}</strong>, and there is a newer version of it
            {whatChanges(plan)}. Anything you have written or changed yourself stays exactly as it
            is. Nothing of yours is overwritten.
          </AlertDescription>
        </AlertContent>
        {/* The documented trailing slot, not a bare sibling: it end-aligns the
            button and, once the row wraps on a narrow screen, keeps it there. */}
        <AlertActions>
          <Button
            size="sm"
            onClick={() => {
              ctx.open('builder.blueprint', { key: blueprint.key }, { target: 'tab' });
            }}
          >
            See what changed
          </Button>
        </AlertActions>
      </Alert>
    </ModuleScope>
  );
}

/** Renders nothing at all when every installed design is current — which is the
 *  usual case, and the panel should cost a reader nothing when it is. */
export function TemplateUpdatePanel({ ctx }: { ctx: SurfaceContext }) {
  const { data } = useBlueprints({ installedOnly: true, take: 20, skip: 0 });
  const stale = (data?.items ?? []).filter((b) => b.install?.update_available);
  if (stale.length === 0) return null;

  return (
    <>
      {stale.map((blueprint) => (
        <UpdateOffer key={blueprint.key} blueprint={blueprint} ctx={ctx} />
      ))}
    </>
  );
}
