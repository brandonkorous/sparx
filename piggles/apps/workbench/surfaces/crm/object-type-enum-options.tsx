'use client';

// The list of choices for a "pick one" detail in the record-type editor.

import { Button, Field, FieldDescription, FieldLabel, Input } from '@wizeworks/silicaui-react';
import { faPlus, faTrashCan } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { keyFromLabel, type PropertyField } from './object-types-data';

interface EnumOptionsProps {
  field: PropertyField;
  onChange: (next: PropertyField) => void;
}

export function EnumOptionsEditor({ field, onChange }: EnumOptionsProps) {
  const options = field.options ?? [];
  return (
    <Field>
      <FieldLabel>The choices</FieldLabel>
      <div className="flex flex-col gap-2">
        {options.map((option, index) => (
          <EnumOptionRow
            key={index}
            field={field}
            onChange={onChange}
            option={option}
            index={index}
          />
        ))}
        <Button
          size="sm"
          color="module"
          variant="outline"
          onClick={() => {
            onChange({ ...field, options: [...options, { label: '', value: '' }] });
          }}
        >
          <Icon glyph={faPlus} className="size-4" aria-hidden />
          Add a choice
        </Button>
      </div>
      <FieldDescription>At least one choice is needed.</FieldDescription>
    </Field>
  );
}

type EnumOption = NonNullable<PropertyField['options']>[number];

function EnumOptionRow({
  field,
  onChange,
  option,
  index,
}: EnumOptionsProps & { option: EnumOption; index: number }) {
  const options = field.options ?? [];
  return (
    <div className="flex items-center gap-2">
      <Input
        color="module"
        value={option.label}
        placeholder="Gold"
        onChange={(e) => {
          const label = e.target.value;
          onChange({
            ...field,
            options: options.map((o, i) =>
              i === index ? { label, value: keyFromLabel(label) || label } : o
            ),
          });
        }}
      />
      <Button
        size="sm"
        color="danger"
        variant="ghost"
        aria-label={`Remove ${option.label}`}
        onClick={() => {
          onChange({ ...field, options: options.filter((_, i) => i !== index) });
        }}
      >
        <Icon glyph={faTrashCan} className="size-4" aria-hidden />
      </Button>
    </div>
  );
}
