'use client';

import { productCopyWith } from '../../../lib/product';
import { Badge, Button, Card, CardBody, Switch, Text, useToast } from '@wizeworks/silicaui-react';
import { faSliders } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { ModuleScope } from '../../../components/module-scope';
import {
  automationErrorMessage,
  useSetAutomationStatus,
  type Automation,
} from '../automations-data';
import { automationState } from '../automations-presentation';
import { automationHealth, type Health } from '../automation-health';
import { PlatformUpdateBadge } from '../platform-version-alert';
import type { RecipeMeta } from '../recipes-catalog';
import { isOn } from './recipe-meta';

interface OpenEvent {
  shiftKey: boolean;
  altKey: boolean;
}

/** The card's own status mutation (one per automation id) and the ON/OFF toggle over it. */
function useRecipeToggle(automation: Automation, meta: RecipeMeta) {
  const toast = useToast();
  const setStatus = useSetAutomationStatus(automation.id);

  const toggle = (next: boolean) => {
    setStatus.mutate(next ? 'active' : 'paused', {
      onSuccess: () => {
        toast.add({
          title: next ? `${meta.title} is on` : `${meta.title} is off`,
          description: next
            ? 'It will run automatically from now on.'
            : 'It is switched off and will not run until you turn it back on.',
          type: 'success',
        });
      },
      onError: (error) => {
        toast.add({
          title: next ? `Could not turn on ${meta.title}` : `Could not turn off ${meta.title}`,
          description: automationErrorMessage(error, 'Nothing was changed. Try again in a moment.'),
          type: 'error',
        });
      },
    });
  };
  return { setStatus, toggle };
}

function RecipeSwitch({
  automation,
  meta,
  on,
  pending,
  toggle,
}: {
  automation: Automation;
  meta: RecipeMeta;
  on: boolean;
  pending: boolean;
  toggle: (next: boolean) => void;
}) {
  return automation.locked ? (
    <div className="flex items-center gap-2">
      <span className="text-sm">Always on</span>
      <Switch
        color="module"
        checked
        disabled
        aria-label={productCopyWith(
          'automations.recipe.alwaysOn',
          `${meta.title} is always on: Piggles manages this and it cannot be turned off`,
          { title: meta.title }
        )}
      />
    </div>
  ) : (
    <Switch
      color="module"
      checked={on}
      disabled={pending}
      aria-label={on ? `Turn off ${meta.title}` : `Turn on ${meta.title}`}
      onCheckedChange={toggle}
    />
  );
}

function RecipeFooter({
  automation,
  state,
  health,
  onCustomize,
}: {
  automation: Automation;
  state: ReturnType<typeof automationState>;
  health: Health | null;
  onCustomize: (event: OpenEvent) => void;
}) {
  return (
    <div className="mt-auto flex items-center justify-between gap-2 pt-1">
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <Badge
          color={health ? health.tone : state.tone}
          variant="soft"
          title={health ? health.detail : state.detail}
        >
          {health ? health.label : state.label}
        </Badge>
        {/* Customized, and we have improved it since: Customize is the way in. */}
        <PlatformUpdateBadge platformUpdateAt={automation.platformUpdateAt} size="md" />
      </div>
      <Button
        size="sm"
        variant="ghost"
        color="module"
        title="Customize this automation. Hold Shift to open alongside, Alt for a new window"
        onClick={onCustomize}
      >
        <Icon glyph={faSliders} className="size-4" aria-hidden />
        Customize
      </Button>
    </div>
  );
}

/** One recipe card: the friendly name + one-liner, a state badge, a big ON/OFF
 *  switch, and a "Customize" hand-off to the editor. Owns its own status mutation
 *  (one per automation id), so the hook is called exactly once per rendered card. */
export function RecipeCard({
  automation,
  meta,
  onCustomize,
}: {
  automation: Automation;
  meta: RecipeMeta;
  onCustomize: (event: OpenEvent) => void;
}) {
  const { setStatus, toggle } = useRecipeToggle(automation, meta);
  const state = automationState(automation.status);
  // "Chase an invoice a week overdue" sat badged a green On while its last eight runs all failed:
  // the fourth screen to show a rule's state, and the last to tell the truth about it.
  // [[feedback_a_fix_leaves_its_neighbour_behind]]
  const health = automationHealth(automation.status, automation.runCount, automation.errorCount);
  const on = isOn(automation.status);
  const glyph = meta.icon;
  return (
    <ModuleScope module={meta.module} className="h-full">
      <Card className="border-module h-full border">
        <CardBody className="flex h-full flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <span className="bg-module text-module-content flex size-10 shrink-0 items-center justify-center rounded-lg">
              <Icon glyph={glyph} className="size-5" aria-hidden />
            </span>
            <RecipeSwitch
              automation={automation}
              meta={meta}
              on={on}
              pending={setStatus.isPending}
              toggle={toggle}
            />
          </div>

          <div className="flex flex-col gap-1">
            <h3 className="text-base font-semibold">{meta.title}</h3>
            <Text>{meta.blurb}</Text>
          </div>

          <RecipeFooter
            automation={automation}
            state={state}
            health={health}
            onCustomize={onCustomize}
          />
        </CardBody>
      </Card>
    </ModuleScope>
  );
}
