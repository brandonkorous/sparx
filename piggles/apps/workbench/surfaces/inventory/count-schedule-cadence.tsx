'use client';

// How often a schedule counts, how much at a time, and how each count runs.

import { Card, Heading, Input, NativeSelect, Switch, Text } from '@wizeworks/silicaui-react';
import { plural } from './data';
import type { CountCadence } from './planning-data';
import { CADENCES, type Draft } from './count-schedule-draft';

interface FieldProps {
  draft: Draft;
  patch: (next: Partial<Draft>) => void;
}

function RunSizeField({ draft, patch }: FieldProps) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-base">How many items per count</span>
      <Input
        type="number"
        min={1}
        max={500}
        className="max-w-32"
        value={String(draft.maxItemsPerRun)}
        onChange={(event) => {
          patch({ maxItemsPerRun: Math.max(1, Number(event.target.value) || 1) });
        }}
      />
      <span className="text-sm">
        A count of four hundred lines does not get done. Each run takes the{' '}
        {plural(draft.maxItemsPerRun, 'item', 'items')} that have gone longest without being counted
        (anything never counted comes first of all) and the rest waits for next time.
      </span>
    </label>
  );
}

function ScheduleSwitches({ draft, patch, isNew }: FieldProps & { isNew: boolean }) {
  return (
    <>
      <div className="flex items-start gap-3">
        <Switch
          color="module"
          checked={draft.isBlind}
          aria-label="Hide the expected figure from whoever is counting"
          onCheckedChange={(checked) => {
            patch({ isBlind: checked });
          }}
        />
        <div className="flex flex-col">
          <Text>Hide the expected figure from whoever is counting</Text>
          <Text className="text-sm">
            On by default, and worth keeping on. A scheduled count exists to measure how accurate
            your stock figures are; showing the counter what to expect measures whether they agree
            with it instead.
          </Text>
        </div>
      </div>

      {!isNew ? (
        <div className="flex items-start gap-3">
          <Switch
            color="module"
            checked={draft.isActive}
            aria-label="Keep this schedule running"
            onCheckedChange={(checked) => {
              patch({ isActive: checked });
            }}
          />
          <div className="flex flex-col">
            <Text>Keep this schedule running</Text>
            <Text className="text-sm">
              Pausing stops new counts appearing. It resumes on a sensible date rather than firing
              every count it missed.
            </Text>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function CountScheduleCadenceCard({ draft, patch, isNew }: FieldProps & { isNew: boolean }) {
  return (
    <Card className="flex flex-col gap-3 p-4">
      <Heading level={3} className="text-base">
        How often, and how much at a time
      </Heading>

      <label className="flex flex-col gap-1">
        <span className="text-base">How often</span>
        <NativeSelect
          value={draft.cadence}
          onChange={(event) => {
            patch({ cadence: event.target.value as CountCadence });
          }}
        >
          {CADENCES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </NativeSelect>
      </label>

      {draft.cadence === 'custom' ? (
        <label className="flex flex-col gap-1">
          <span className="text-base">Days between counts</span>
          <Input
            type="number"
            min={1}
            max={3650}
            className="max-w-32"
            value={String(draft.intervalDays)}
            onChange={(event) => {
              patch({ intervalDays: Math.max(1, Number(event.target.value) || 1) });
            }}
          />
        </label>
      ) : null}

      <RunSizeField draft={draft} patch={patch} />
      <ScheduleSwitches draft={draft} patch={patch} isNew={isNew} />
    </Card>
  );
}
