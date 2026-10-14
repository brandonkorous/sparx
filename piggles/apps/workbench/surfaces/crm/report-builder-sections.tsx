'use client';

// The short sections of the report builder's sentence: its name, what it looks
// at, how it is broken down, and how it is shown (docs/144 §8).

import {
  Field,
  FieldDescription,
  FieldLabel,
  Input,
  Select,
  Textarea,
} from '@wizeworks/silicaui-react';

import { FormSection } from '../../components/form-section';
import {
  BUCKET_LABEL,
  VISUALIZATION_LABEL,
  type DateBucket,
  type ReportableObject,
  type Visualization,
} from './report-builder-data';
import type { DraftProps } from './report-builder-draft';

export function NameSection({ draft, readOnly, edit }: DraftProps) {
  return (
    <FormSection title="What to call it">
      <Field>
        <FieldLabel>Name</FieldLabel>
        <Input
          color="module"
          value={draft.name}
          disabled={readOnly}
          placeholder="Customers by county"
          onChange={(event) => edit((current) => ({ ...current, name: event.target.value }))}
        />
      </Field>
      <Field>
        <FieldLabel>What it tells you</FieldLabel>
        <Textarea
          color="module"
          rows={2}
          value={draft.description}
          disabled={readOnly}
          placeholder="Optional: a sentence for whoever opens this next."
          onChange={(event) => edit((current) => ({ ...current, description: event.target.value }))}
        />
      </Field>
    </FormSection>
  );
}

function PeriodField({ draft, readOnly, edit }: DraftProps) {
  return (
    <Field>
      <FieldLabel>Over what period</FieldLabel>
      <Select
        color="module"
        value={draft.rangeKind === 'last_n_days' ? String(draft.rangeDays) : 'all'}
        disabled={readOnly}
        items={{
          all: 'All time',
          '7': 'Last 7 days',
          '30': 'Last 30 days',
          '90': 'Last 90 days',
          '365': 'Last 12 months',
        }}
        onValueChange={(next) => {
          edit((current) =>
            next === 'all'
              ? { ...current, rangeKind: 'all' }
              : { ...current, rangeKind: 'last_n_days', rangeDays: Number(next) }
          );
        }}
      />
      <FieldDescription>
        A rolling period stays true tomorrow, which is what makes a report worth pinning to a
        dashboard.
      </FieldDescription>
    </Field>
  );
}

export function LookAtSection(props: DraftProps & { objects: ReportableObject[] }) {
  const { draft, readOnly, edit, objects } = props;
  return (
    <FormSection title="What to look at">
      <Field>
        <FieldLabel>Records</FieldLabel>
        <Select
          color="module"
          value={draft.objectKey}
          disabled={readOnly}
          items={Object.fromEntries(objects.map((o) => [o.objectKey, o.labelPlural]))}
          onValueChange={(next) => {
            // Fields belong to an object, so a new one clears the breakdown, the
            // measures and the conditions: `deal.value` is not on a customer.
            edit((current) => ({
              ...current,
              objectKey: next as string,
              groupByField: '',
              groupByBucket: '',
              measures: [{ fn: 'count' }],
              conditions: [],
              opaqueFilters: null,
            }));
          }}
        />
      </Field>
      <PeriodField {...props} />
    </FormSection>
  );
}

export function BreakdownSection({ draft, readOnly, fields, edit }: DraftProps) {
  const groupField = fields.find((f) => f.path === draft.groupByField);
  return (
    <FormSection title="How to break it down">
      <Field>
        <FieldLabel>Broken down by</FieldLabel>
        <Select
          color="module"
          value={draft.groupByField}
          disabled={readOnly}
          items={{
            '': 'Nothing: just one total',
            ...Object.fromEntries(fields.map((f) => [f.path, f.label])),
          }}
          onValueChange={(next) => {
            edit((current) => ({ ...current, groupByField: next as string }));
          }}
        />
      </Field>
      {groupField?.kind === 'date' ? (
        <Field>
          <FieldLabel>Grouped</FieldLabel>
          <Select
            color="module"
            value={draft.groupByBucket || 'month'}
            disabled={readOnly}
            items={BUCKET_LABEL}
            onValueChange={(next) =>
              edit((current) => ({ ...current, groupByBucket: next as DateBucket }))
            }
          />
          <FieldDescription>
            A date needs grouping, or you get one row per moment instead of a breakdown.
          </FieldDescription>
        </Field>
      ) : null}
    </FormSection>
  );
}

export function ShowAsSection(props: DraftProps & { allowed: Visualization[] }) {
  const { draft, readOnly, edit, allowed } = props;
  return (
    <FormSection title="How to show it">
      <Field>
        <FieldLabel>Show it as</FieldLabel>
        <Select
          color="module"
          value={draft.visualization}
          disabled={readOnly}
          items={Object.fromEntries(allowed.map((v) => [v, VISUALIZATION_LABEL[v]]))}
          onValueChange={(next) =>
            edit((current) => ({ ...current, visualization: next as Visualization }))
          }
        />
        <FieldDescription>
          Only the shapes this report can honestly draw are offered.
        </FieldDescription>
      </Field>
    </FormSection>
  );
}
