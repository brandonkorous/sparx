'use client';

// A field that credits one of the business's authors: "Photograph by", "Illustrated
// by". It stores the author's id, so the credit is a link to their page and their
// page lists the piece. A name typed into a text box did neither.

import { useEffect, useMemo } from 'react';
import { FieldControl, NativeSelect, Text } from '@wizeworks/silicaui-react';

import { ChipMultiSelect } from './chip-multi-select';
import { useAuthors } from './data';

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

export function AuthorField({
  multiple,
  value,
  onChange,
  disabled,
}: {
  multiple: boolean;
  value: unknown;
  onChange: (next: unknown) => void;
  disabled?: boolean;
}) {
  const { data, isPending, isError } = useAuthors();
  const options = useMemo(
    () => (data ?? []).map((author) => ({ value: author.id, label: author.display_name })),
    [data]
  );

  // A field changed from short text keeps what was typed until the piece is saved
  // again. Typed text that is exactly one author's name becomes that author.
  const typed = typeof value === 'string' && !options.some((o) => o.value === value) ? value : '';
  const named = typed ? options.find((o) => sameName(o.label, typed)) : undefined;
  useEffect(() => {
    if (named && !multiple) onChange(named.value);
  }, [named, multiple, onChange]);

  if (isPending) {
    return (
      <Text className="text-sm" role="status">
        Loading your authors…
      </Text>
    );
  }
  if (isError) {
    return <Text className="text-sm">Could not load your authors.</Text>;
  }
  if (options.length === 0) {
    return (
      <Text className="text-sm">
        You have not added any authors yet. Add them under Content, in Authors.
      </Text>
    );
  }

  if (multiple) {
    return (
      <ChipMultiSelect
        options={options}
        selected={asStringArray(value)}
        disabled={disabled}
        onChange={onChange}
      />
    );
  }

  return (
    <>
      <FieldControl
        render={
          <NativeSelect
            color="module"
            value={named?.value ?? asString(value)}
            disabled={disabled}
            onChange={(event) => {
              onChange(event.target.value || undefined);
            }}
          >
            <option value="">No one</option>
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </NativeSelect>
        }
      />
      {typed && !named ? (
        <Text className="text-sm">
          This says “{typed}”, which is not one of your authors. Choose who it is, or add them under
          Authors.
        </Text>
      ) : null}
    </>
  );
}

function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}
