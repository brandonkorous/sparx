'use client';

// What the place is called and what kind of place it is — the half of the form
// that identifies it. Where it is lives in location-address.

import {
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  FieldStatus,
  Input,
  NativeSelect,
} from '@wizeworks/silicaui-react';
import { FormSection } from '../../components/form-section';
import { LOCATION_TYPES, locationTypeHint } from './locations-data';
import { cleanCode, type Draft } from './location-draft';
import { LocationAddress } from './location-address';

export interface FieldsProps {
  isNew: boolean;
  draft: Draft;
  set: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
  codeError: string | null;
  showAddrWarning: boolean;
}

function KindField({
  draft,
  set,
}: {
  draft: Draft;
  set: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
}) {
  return (
    <Field>
      <FieldLabel>What kind of place</FieldLabel>
      <FieldControl
        render={
          <NativeSelect
            value={draft.type}
            aria-label="What kind of place"
            onChange={(event) => {
              set('type', event.target.value);
            }}
          >
            {LOCATION_TYPES.map((kind) => (
              <option key={kind.value} value={kind.value}>
                {kind.label}
              </option>
            ))}
          </NativeSelect>
        }
      />
      <FieldDescription>{locationTypeHint(draft.type)}</FieldDescription>
    </Field>
  );
}

function Identity({ isNew, draft, set, codeError }: Omit<FieldsProps, 'showAddrWarning'>) {
  return (
    <FormSection
      title={isNew ? 'New location' : 'Name and kind'}
      description={
        isNew
          ? 'A location is any place you keep stock. Give it a name, a short code for your shelves and paperwork, and say what kind of place it is.'
          : undefined
      }
    >
      <Field>
        <FieldLabel>Location name</FieldLabel>
        <FieldControl
          render={
            <Input
              color="module"
              value={draft.name}
              placeholder="Riverside Warehouse"
              onChange={(event) => {
                set('name', event.target.value);
              }}
            />
          }
        />
        <FieldDescription>What you call this place day to day.</FieldDescription>
      </Field>

      <Field>
        <FieldLabel>Short code</FieldLabel>
        <FieldControl
          render={
            <Input
              color={codeError ? 'error' : 'module'}
              value={draft.code}
              placeholder="RIV"
              className="max-w-40 font-mono"
              onChange={(event) => {
                set('code', cleanCode(event.target.value));
              }}
            />
          }
        />
        {codeError ? (
          <FieldStatus status="error">{codeError}</FieldStatus>
        ) : (
          <FieldDescription>
            A short label for this place, printed on shelf tickets and paperwork — letters, numbers
            and dashes, up to fifteen. It must be different from your other locations.
          </FieldDescription>
        )}
      </Field>

      <KindField draft={draft} set={set} />
    </FormSection>
  );
}

export function LocationFields(props: FieldsProps) {
  return (
    <>
      <Identity
        isNew={props.isNew}
        draft={props.draft}
        set={props.set}
        codeError={props.codeError}
      />
      <LocationAddress
        draft={props.draft}
        set={props.set}
        showAddrWarning={props.showAddrWarning}
      />
    </>
  );
}
