'use client';

// The action hub: which site, whether the examples come, and the one thing you
// can do to that site right now. They live together because every one of them
// pivots on the chosen site — splitting the picker from its button is how the two
// drift apart.

import {
  Button,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Select,
  Switch,
  Text,
} from '@wizeworks/silicaui-react';
import { faRocket, faTrashCan } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';

import { FormSection } from '../../components/form-section';
import { examplesSentence } from './blueprints-words';
import type { Blueprint, BlueprintInstall } from './blueprints-data';

export interface TargetSectionProps {
  blueprint: Blueprint;
  sites: Record<string, string>;
  sitesLoaded: boolean;
  targetSite: string;
  targetName: string;
  onSite: (id: string) => void;
  /** Does this design bring any examples at all? A design with none never asks. */
  hasExamples: boolean;
  sampleData: boolean;
  onSampleData: (next: boolean) => void;
  current: BlueprintInstall | undefined;
  busy: boolean;
  installing: boolean;
  publishing: boolean;
  removing: boolean;
  onInstall: () => void;
  onGoLive: () => void;
  onRemove: () => void;
}

/** The choice the whole of issue 098 is about. Only shown before an install: once
 *  a design is in, the answer is a fact about it rather than a control. */
function ExamplesField({
  value,
  onChange,
  disabled,
}: {
  value: boolean;
  onChange: (next: boolean) => void;
  disabled: boolean;
}) {
  return (
    <Field>
      <FieldLabel>Bring its examples</FieldLabel>
      <FieldControl
        render={
          <Switch
            color="module"
            checked={value}
            disabled={disabled}
            onCheckedChange={onChange}
            aria-label="Bring this design's examples"
          />
        }
      />
      <FieldDescription>{examplesSentence(value)}</FieldDescription>
    </Field>
  );
}

function RemoveRow({
  targetName,
  removing,
  disabled,
  onRemove,
}: {
  targetName: string;
  removing: boolean;
  disabled: boolean;
  onRemove: () => void;
}) {
  // Removal is rare and irreversible, so it is a plain row under a divider —
  // never a button with equal weight to publishing.
  return (
    <div className="border-base-300 mt-1 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
      <div className="flex min-w-0 flex-col">
        <Text className="font-medium">Remove this design from {targetName}</Text>
        <Text className="text-sm">
          Deletes everything it added to that site. This cannot be undone.
        </Text>
      </div>
      <Button
        variant="outline"
        color="danger"
        size="sm"
        loading={removing}
        disabled={disabled}
        onClick={onRemove}
      >
        <Icon glyph={faTrashCan} className="size-4" aria-hidden />
        Remove
      </Button>
    </div>
  );
}

export function BlueprintTargetSection(props: TargetSectionProps) {
  const { blueprint, current, targetName, targetSite, busy } = props;

  return (
    <FormSection
      title="Add it to a site"
      description="Pick which site this design goes into. You can add it to more than one."
    >
      <Field>
        <FieldLabel>Site</FieldLabel>
        {props.sitesLoaded ? (
          <Select
            color="module"
            items={props.sites}
            value={targetSite}
            aria-label="Which site to add this design to"
            onValueChange={(next) => {
              props.onSite(next as string);
            }}
          />
        ) : (
          <Text className="text-sm" role="status">
            Loading your sites…
          </Text>
        )}
        <FieldDescription>
          The design is added only to the site you choose here — your other sites are not touched.
        </FieldDescription>
      </Field>

      {!current && props.hasExamples ? (
        <ExamplesField value={props.sampleData} onChange={props.onSampleData} disabled={busy} />
      ) : null}

      {current ? (
        <>
          {current.status === 'installed' ? (
            <Button
              color="module"
              onClick={props.onGoLive}
              loading={props.publishing}
              disabled={busy && !props.publishing}
            >
              <Icon glyph={faRocket} className="size-4" aria-hidden />
              Publish it live on {targetName}
            </Button>
          ) : null}

          {current.status === 'running' ? (
            <Text className="text-sm">
              This design is still being added to {targetName}. Refresh in a moment to see it
              finish.
            </Text>
          ) : null}

          <RemoveRow
            targetName={targetName}
            removing={props.removing}
            disabled={busy && !props.removing}
            onRemove={props.onRemove}
          />
        </>
      ) : (
        <Button
          color="module"
          disabled={targetSite === '' || busy}
          loading={props.installing}
          onClick={props.onInstall}
        >
          Add “{blueprint.name}” to {targetName}
        </Button>
      )}
    </FormSection>
  );
}
