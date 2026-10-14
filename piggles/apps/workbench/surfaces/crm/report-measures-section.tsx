'use client';

// "What to work out": the report builder's measures, up to four (docs/144 §8).

import { Button, Field, FieldLabel, Select } from '@wizeworks/silicaui-react';

import { FormSection } from '../../components/form-section';
import {
  MEASURE_LABEL,
  allowedFunctions,
  type Measure,
  type MeasureFn,
} from './report-builder-data';
import type { DraftProps } from './report-builder-draft';

function MeasureValueField({ measure, index, readOnly, fields, edit }: MeasureRowProps) {
  return (
    <Field>
      <FieldLabel>Of which value</FieldLabel>
      <Select
        color="module"
        value={measure.field ?? ''}
        disabled={readOnly}
        items={Object.fromEntries(
          fields
            .filter((f) => f.kind === 'number' || f.kind === 'currency')
            .map((f) => [f.path, f.label])
        )}
        onValueChange={(next) => {
          edit((current) => {
            const measures = [...current.measures];
            measures[index] = { ...measures[index], field: next as string } as Measure;
            return { ...current, measures };
          });
        }}
      />
    </Field>
  );
}

type MeasureRowProps = DraftProps & { measure: Measure; index: number };

function MeasureRow(props: MeasureRowProps) {
  const { measure, index, readOnly, fields, edit } = props;
  const measureField = fields.find((f) => f.path === measure.field);
  const functions = allowedFunctions(measureField?.kind);
  return (
    <div className="flex flex-col gap-2">
      <Field>
        <FieldLabel>{index === 0 ? 'Work out' : 'And also'}</FieldLabel>
        <Select
          color="module"
          value={measure.fn}
          disabled={readOnly}
          items={Object.fromEntries(functions.map((fn) => [fn, MEASURE_LABEL[fn]]))}
          onValueChange={(next) => {
            edit((current) => {
              const measures = [...current.measures];
              const fn = next as MeasureFn;
              measures[index] = fn === 'count' ? { fn } : { fn, field: measure.field };
              return { ...current, measures };
            });
          }}
        />
      </Field>
      {measure.fn !== 'count' ? <MeasureValueField {...props} /> : null}
      {index > 0 && !readOnly ? (
        <div>
          <Button
            color="neutral"
            variant="ghost"
            size="sm"
            onClick={() => {
              edit((current) => ({
                ...current,
                measures: current.measures.filter((_, i) => i !== index),
              }));
            }}
          >
            Remove
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function MeasuresSection(props: DraftProps) {
  const { draft, readOnly, edit } = props;
  return (
    <FormSection title="What to work out">
      {draft.measures.map((measure, index) => (
        <MeasureRow key={index} {...props} measure={measure} index={index} />
      ))}
      {!readOnly && draft.measures.length < 4 ? (
        <div>
          <Button
            color="module"
            variant="outline"
            size="sm"
            onClick={() => {
              edit((current) => ({
                ...current,
                measures: [...current.measures, { fn: 'count' }],
              }));
            }}
          >
            Work out something else too
          </Button>
        </div>
      ) : null}
    </FormSection>
  );
}
