'use client';

// The setup half of a campaign: its name, its steps, and what counts as success.

import {
  Field,
  FieldControl,
  FieldLabel,
  Heading,
  Input,
  Text,
  Textarea,
} from '@wizeworks/silicaui-react';
import type { ConditionGroup } from '@wizeworks/automation-schemas';
import { ConditionEditor } from '../automations/condition-editor';
import { StageLadderEditor } from './stage-editor';
import type { FunnelStage } from './types';

export interface SetupDraft {
  name: string;
  description: string;
  stages: FunnelStage[];
  goal: ConditionGroup;
}

export interface SetupHandlers {
  setName: (value: string) => void;
  setDescription: (value: string) => void;
  setStages: (value: FunnelStage[]) => void;
  setGoal: (value: ConditionGroup) => void;
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

export function CampaignSetup({
  draft,
  on,
  canEdit,
  error,
}: {
  draft: SetupDraft;
  on: SetupHandlers;
  canEdit: boolean;
  error: string | null;
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

      {error ? <Text className="text-danger text-sm">{error}</Text> : null}
    </section>
  );
}
