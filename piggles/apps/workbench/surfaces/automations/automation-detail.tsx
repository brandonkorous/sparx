'use client';

// One automation — create it, or open one to manage it. Create and edit share
// the same shape, so this is a PANE in two states, never a create modal:
// `{ id: 'new' }` builds a new rule, `{ id }` manages an existing one.
//
// A LOCKED rule is platform-managed — it can't be edited, paused or deleted, so
// showing it in the editor would be a wall of disabled controls that reads as
// broken. Instead it opens read-only, explaining what it does, with one real
// affordance: "Duplicate to edit", which forks an editable copy you own.

import { useEffect, useMemo } from 'react';
import { PaneWaiting } from '../../components/pane-waiting';
import { PaneLoadError } from '../../components/pane-load-error';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  Text,
  useToast,
} from '@wizeworks/silicaui-react';
import { faClone, faListCheck } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { afterPaneChange } from '../../lib/defer';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import { FormSection } from '../../components/form-section';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import { AutomationEditor } from './automation-editor';
import {
  actionSummaryText,
  automationState,
  ConditionGroupView,
  parseActions,
  parseConditions,
  summarizeTrigger,
  TierBadge,
} from './automations-presentation';
import {
  automationErrorMessage,
  useAutomation,
  useCloneAutomation,
  type Automation,
} from './automations-data';
import { productCopy } from '../../lib/product';

const COLUMN = 'mx-auto flex w-full max-w-3xl flex-col gap-4';

function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

export function AutomationDetailSurface({ ctx }: { ctx: SurfaceContext }) {
  const id = typeof ctx.params.id === 'string' ? ctx.params.id : 'new';
  if (id === 'new') return <AutomationEditor ctx={ctx} />;
  return <ManageAutomation ctx={ctx} id={id} />;
}

function ManageAutomation({ ctx, id }: { ctx: SurfaceContext; id: string }) {
  const {
    data: automation,
    isPending,
    isError,
    error,
    isFetching,
    dataUpdatedAt,
    refetch,
  } = useAutomation(id);

  if (isError) {
    return (
      <div className={`${PANE_SHELL} p-2`}>
        <Card className="min-h-0 flex-1 items-center justify-center">
          <PaneLoadError
            error={error}
            noun="automation"
            title="Could not load this automation"
            description="This is a problem reaching the server, or the automation no longer exists. Nothing has been changed."
            onRetry={() => {
              void refetch();
            }}
          />
        </Card>
      </div>
    );
  }

  if (isPending || !automation) {
    return <PaneWaiting />;
  }

  if (automation.locked)
    return (
      <LockedAutomation
        ctx={ctx}
        automation={automation}
        isFetching={isFetching}
        updatedAt={dataUpdatedAt}
        onRefresh={() => {
          void refetch();
        }}
      />
    );
  return <AutomationEditor ctx={ctx} automation={automation} />;
}

function LockedAutomation({
  ctx,
  automation,
  isFetching,
  updatedAt,
  onRefresh,
}: {
  ctx: SurfaceContext;
  automation: Automation;
  isFetching: boolean;
  updatedAt: number | undefined;
  onRefresh: () => void;
}) {
  const toast = useToast();
  const clone = useCloneAutomation(automation.id);
  const state = automationState(automation.status);

  const actions = useMemo(() => parseActions(automation.actions), [automation.actions]);
  const conditions = useMemo(() => parseConditions(automation.conditions), [automation.conditions]);

  useEffect(() => {
    ctx.setTitle(automation.name);
  }, [ctx, automation.name]);

  const onClone = () => {
    clone.mutate(`${automation.name} (copy)`, {
      onSuccess: (created) => {
        ctx.open('automations.detail', { id: created.id }, { target: 'replace' });
        afterPaneChange(() => {
          toast.add({
            title: 'Editable copy created',
            description: 'Change it however you like — the original is untouched.',
            type: 'success',
          });
        });
      },
      onError: (error) => {
        toast.add({
          title: 'Could not duplicate this automation',
          description: automationErrorMessage(error, 'Nothing was changed.'),
          type: 'error',
        });
      },
    });
  };

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar
        label="Automation actions"
        status={
          <>
            <Badge color={state.tone} variant="soft" size="sm">
              {state.label}
            </Badge>
            <TierBadge origin={automation.origin} locked={automation.locked} />
          </>
        }
        primary={
          <Button
            size="sm"
            variant="outline"
            className="ml-auto shrink-0"
            onClick={(event) => {
              ctx.open(
                'automations.runs',
                { automationId: automation.id },
                { target: targetFor(event) }
              );
            }}
          >
            <Icon glyph={faListCheck} className="size-4" aria-hidden />
            Runs
          </Button>
        }
        controls={
          <Button
            size="sm"
            color="module"
            className="shrink-0"
            loading={clone.isPending}
            onClick={onClone}
          >
            <Icon glyph={faClone} className="size-4" aria-hidden />
            Duplicate to edit
          </Button>
        }
        refresh={
          <RefreshButton isFetching={isFetching} updatedAt={updatedAt} onRefresh={onRefresh} />
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={COLUMN}>
          {automation.description ? (
            <Text className="text-sm">{automation.description}</Text>
          ) : null}

          <Alert color="info">
            <AlertContent>
              <AlertTitle>
                {productCopy('automations.badge.managed', 'Managed by sparx')}
              </AlertTitle>
              <AlertDescription>
                {productCopy(
                  'automations.managed.body',
                  'This automation is looked after by Piggles, so it can’t be changed here. To make your own version, use “Duplicate to edit” — it copies everything into a rule you own and can change freely, and the original keeps running untouched.'
                )}
              </AlertDescription>
            </AlertContent>
          </Alert>

          <FormSection title="When this runs">
            <Text className="text-sm">
              {summarizeTrigger(automation.triggerType, automation.triggerConfig)}
            </Text>
          </FormSection>

          <FormSection title="Only if">
            <ConditionGroupView group={conditions} />
          </FormSection>

          <FormSection title="Then it does">
            {actions.length === 0 ? (
              <Text className="text-sm">Nothing configured.</Text>
            ) : (
              <ol className="flex flex-col gap-2">
                {actions.map((action, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="bg-base-200 mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
                      {i + 1}
                    </span>
                    <Text as="span" className="text-sm">
                      {actionSummaryText(action)}
                    </Text>
                  </li>
                ))}
              </ol>
            )}
          </FormSection>
        </div>
      </div>
    </div>
  );
}
