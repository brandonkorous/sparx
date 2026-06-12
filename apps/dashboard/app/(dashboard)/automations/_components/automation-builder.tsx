'use client';

// The automation builder form — composes the trigger / condition / action editors
// plus name, description, and the loop-guard ceiling into one create-or-edit form.
// Builds the canonical CreateAutomationInput / UpdateAutomationInput document and
// posts it through the Server Actions (the api-rest service is the single write
// path). Client-side validation catches the obvious authoring mistakes early; the
// server is still the source of truth (per-action config is validated at dispatch).

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  FormActionBar,
  Input,
  Label,
  Textarea,
} from '@sparx/ui';
import type { Action, ConditionGroup, Trigger } from '@sparx/automation-schemas';
import { actionDef } from '../_lib/catalog';
import { createAutomationAction, updateAutomationAction } from '../actions';
import { ActionEditor } from './action-editor';
import { ConditionEditor } from './condition-editor';
import { TriggerEditor } from './trigger-editor';

const DEFAULT_TRIGGER: Trigger = { kind: 'event', eventType: '' };
const DEFAULT_CONDITIONS: ConditionGroup = { logic: 'AND', conditions: [] };

export interface BuilderInitial {
  id: string;
  name: string;
  description: string | null;
  trigger: Trigger;
  conditions: ConditionGroup;
  actions: Action[];
  maxDepth: number;
}

interface Props {
  enabledModules: readonly string[];
  /** Present → edit mode; absent → create mode. */
  initial?: BuilderInitial;
}

export function AutomationBuilder({ enabledModules, initial }: Props) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const [name, setName] = React.useState(initial?.name ?? '');
  const [description, setDescription] = React.useState(initial?.description ?? '');
  const [trigger, setTrigger] = React.useState<Trigger>(initial?.trigger ?? DEFAULT_TRIGGER);
  const [conditions, setConditions] = React.useState<ConditionGroup>(
    initial?.conditions ?? DEFAULT_CONDITIONS
  );
  const [actions, setActions] = React.useState<Action[]>(initial?.actions ?? []);
  const [maxDepth, setMaxDepth] = React.useState(initial?.maxDepth ?? 3);

  const editing = initial !== undefined;
  const cancelHref = editing ? `/automations/${initial.id}` : '/automations';

  function firstError(): string | null {
    if (!name.trim()) return 'Give the automation a name.';
    if (trigger.kind === 'event' && !trigger.eventType.trim()) {
      return 'Choose a trigger event.';
    }
    if (trigger.kind === 'schedule') {
      if (trigger.schedule.cadence === 'once' && !trigger.schedule.at) {
        return 'Pick a date and time for the one-time schedule.';
      }
      if (!trigger.predicate.entity) return 'Choose what the schedule scans.';
    }
    if (actions.length === 0) return 'Add at least one action.';
    for (const [i, a] of actions.entries()) {
      const def = actionDef(a.type);
      if (def?.mode === 'fields' && def.configFields) {
        const config = a.config ?? {};
        for (const f of def.configFields) {
          if (!f.required) continue;
          const v = config[f.key];
          const missing = v === undefined || v === '' || (Array.isArray(v) && v.length === 0);
          if (missing) return `Action ${i + 1} (${def.label}) needs “${f.label}”.`;
        }
      }
    }
    return null;
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const validation = firstError();
    if (validation) {
      setError(validation);
      return;
    }
    setError(null);

    const payload = {
      name: name.trim(),
      description: description.trim() ? description.trim() : null,
      trigger,
      conditions,
      actions,
      maxDepth,
    };

    startTransition(async () => {
      const result = editing
        ? await updateAutomationAction(initial.id, payload)
        : await createAutomationAction(payload);
      if (result.ok) {
        router.push(`/automations/${result.data.id}`);
        router.refresh();
        return;
      }
      setError(result.error.message);
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="automation-name">Name</Label>
            <Input
              id="automation-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Fleet re-engagement"
              className="max-w-md"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="automation-description">Description</Label>
            <Textarea
              id="automation-description"
              value={description}
              rows={2}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this automation does and when."
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Trigger</CardTitle>
          <CardDescription>What starts this automation.</CardDescription>
        </CardHeader>
        <CardContent>
          <TriggerEditor value={trigger} onChange={setTrigger} enabledModules={enabledModules} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Conditions</CardTitle>
          <CardDescription>Run only if these match (optional).</CardDescription>
        </CardHeader>
        <CardContent>
          <ConditionEditor value={conditions} onChange={setConditions} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
          <CardDescription>What it does, in order.</CardDescription>
        </CardHeader>
        <CardContent>
          <ActionEditor value={actions} onChange={setActions} enabledModules={enabledModules} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Advanced</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="automation-max-depth">Loop-guard depth</Label>
            <Input
              id="automation-max-depth"
              type="number"
              min={1}
              max={10}
              value={maxDepth}
              onChange={(e) => setMaxDepth(Math.min(10, Math.max(1, Number(e.target.value) || 1)))}
              className="w-24"
            />
            <span className="text-xs text-[var(--color-text-tertiary)]">
              How deep a rule → event → rule cascade may go before the engine stops it.
            </span>
          </div>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}

      <FormActionBar>
        <Button type="button" variant="ghost" asChild>
          <Link href={cancelHref}>Cancel</Link>
        </Button>
        <Button type="submit" color="module" loading={pending} disabled={pending}>
          {editing ? 'Save changes' : 'Create automation'}
        </Button>
      </FormActionBar>
    </form>
  );
}
