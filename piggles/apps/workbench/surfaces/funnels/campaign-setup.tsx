'use client';

// The setup half of a campaign: its name, its steps, what counts as success,
// and how long it waits before calling somebody gone.

import {
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Heading,
  Input,
  Select,
  Text,
  Textarea,
} from '@wizeworks/silicaui-react';
import type { ConditionGroup } from '@wizeworks/automation-schemas';
import { ConditionEditor } from '../automations/condition-editor';
import { STALL_CHOICES, hoursLabel } from './presentation';
import { StageLadderEditor } from './stage-editor';
import type { FunnelStage } from './types';

export interface SetupDraft {
  name: string;
  description: string;
  stages: FunnelStage[];
  goal: ConditionGroup;
  stallAfterHours: number | null;
}

export interface SetupHandlers {
  setName: (value: string) => void;
  setDescription: (value: string) => void;
  setStages: (value: FunnelStage[]) => void;
  setGoal: (value: ConditionGroup) => void;
  setStallAfterHours: (value: number | null) => void;
}

function Identity({
  draft,
  on,
  canEdit,
}: {
  draft: SetupDraft;
  on: SetupHandlers;
  canEdit: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 @2xl:grid-cols-2">
      <Field>
        <FieldLabel>Name</FieldLabel>
        <FieldControl
          render={
            <Input
              color="module"
              value={draft.name}
              disabled={!canEdit}
              onChange={(event) => {
                on.setName(event.target.value);
              }}
            />
          }
        />
      </Field>
      <Field>
        <FieldLabel>What is it for?</FieldLabel>
        <FieldControl
          render={
            <Textarea
              color="module"
              rows={2}
              value={draft.description}
              disabled={!canEdit}
              onChange={(event) => {
                on.setDescription(event.target.value);
              }}
            />
          }
        />
      </Field>
    </div>
  );
}

function Patience({
  draft,
  on,
  canEdit,
  defaultStallHours,
}: {
  draft: SetupDraft;
  on: SetupHandlers;
  canEdit: boolean;
  defaultStallHours: number | undefined;
}) {
  const chosen = draft.stallAfterHours;
  return (
    <div className="flex flex-col gap-2">
      <Heading level={3} className="text-base font-semibold">
        When to give up on somebody
      </Heading>
      <Text className="text-sm">
        Somebody who starts and then goes quiet is not a failure yet, but at some point they are
        gone. This is how long to wait before saying so, which is what any follow-up you have set up
        waits for.
      </Text>
      <Field>
        <FieldLabel>Give up after</FieldLabel>
        <FieldControl
          render={
            <Select
              color="module"
              aria-label="Give up after"
              disabled={!canEdit}
              value={chosen === null ? 'default' : String(chosen)}
              onValueChange={(value) => {
                on.setStallAfterHours(value === 'default' ? null : Number(value));
              }}
              items={[
                {
                  value: 'default',
                  label: defaultStallHours
                    ? `The usual for this kind of campaign (${hoursLabel(defaultStallHours)})`
                    : 'The usual for this kind of campaign',
                },
                ...STALL_CHOICES.map((hours) => ({
                  value: String(hours),
                  label: hoursLabel(hours),
                })),
              ]}
            />
          }
        />
        <FieldDescription>
          {chosen === null
            ? 'Every campaign of this kind waits the same amount of time. Choose a length to give this one its own.'
            : 'This campaign waits a different amount of time to others of its kind, because you said so.'}
        </FieldDescription>
      </Field>
    </div>
  );
}

export function CampaignSetup({
  draft,
  on,
  canEdit,
  error,
  defaultStallHours,
}: {
  draft: SetupDraft;
  on: SetupHandlers;
  canEdit: boolean;
  error: string | null;
  defaultStallHours: number | undefined;
}) {
  return (
    <section className="flex flex-col gap-3">
      <Heading level={2} className="text-lg font-semibold">
        Setup
      </Heading>

      <Identity draft={draft} on={on} canEdit={canEdit} />

      <div className="flex flex-col gap-2">
        <Heading level={3} className="text-base font-semibold">
          The steps
        </Heading>
        <Text className="text-sm">
          In order, from the first thing somebody does to the outcome you want. Renaming a step
          keeps everything it has already recorded.
        </Text>
        <StageLadderEditor stages={draft.stages} onChange={on.setStages} disabled={!canEdit} />
      </div>

      <div className="flex flex-col gap-2">
        <Heading level={3} className="text-base font-semibold">
          What counts as success
        </Heading>
        <Text className="text-sm">
          Without this the campaign can only tell you what happened, not whether it worked, so it
          cannot be turned on.
        </Text>
        <ConditionEditor value={draft.goal} onChange={on.setGoal} label="people" />
      </div>

      <Patience draft={draft} on={on} canEdit={canEdit} defaultStallHours={defaultStallHours} />

      {error ? <Text className="text-danger text-sm">{error}</Text> : null}
    </section>
  );
}
