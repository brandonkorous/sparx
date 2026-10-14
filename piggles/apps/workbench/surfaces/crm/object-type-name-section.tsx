'use client';

// "What this is": the record type's names, link name and purpose.

import {
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Input,
  Textarea,
} from '@wizeworks/silicaui-react';
import { FormSection } from '../../components/form-section';
import { productCopy } from '../../lib/product';
import { keyFromLabel } from './object-types-data';
import { pluralise } from './object-type-draft';
import type { ObjectTypeEditor } from './use-object-type-editor';

// A ready-made type keeps its own sidebar row whatever it is called here, so the
// copy must not promise a rename reaches the rail. [[feedback_a_promise_in_copy_is_a_contract]]
export function ObjectTypeNameSection({ ed }: { ed: ObjectTypeEditor }) {
  return (
    <FormSection
      title="What this is"
      description={
        ed.isBuiltin
          ? 'The name you want to see on these records. This one came ready-made, so it keeps its own place in your sidebar whatever you call it here.'
          : 'The name you want to see in your sidebar and on your records.'
      }
    >
      <SingularNameField ed={ed} />
      <PluralNameField ed={ed} />
      {ed.isNew ? <LinkNameField ed={ed} /> : null}
      <PurposeField ed={ed} />
    </FormSection>
  );
}

function SingularNameField({ ed }: { ed: ObjectTypeEditor }) {
  const { draft, setDraft, pluralTouched, isNew, nameError } = ed;
  return (
    <Field>
      <FieldLabel>Name for one</FieldLabel>
      <FieldControl
        render={
          <Input
            color="module"
            value={draft.label}
            placeholder="Project"
            onChange={(e) => {
              const label = e.target.value;
              setDraft((d) => ({
                ...d,
                label,
                // Follow the singular until they type their own plural. A real VALUE,
                // not a placeholder, so what shows is what saves.
                labelPlural: pluralTouched ? d.labelPlural : pluralise(label),
                key: isNew && d.key === '' ? '' : d.key,
              }));
            }}
          />
        }
      />
      {nameError ? <FieldDescription>{nameError}</FieldDescription> : null}
    </Field>
  );
}

function PluralNameField({ ed }: { ed: ObjectTypeEditor }) {
  const { draft, setDraft, setPluralTouched } = ed;
  return (
    <Field>
      <FieldLabel>Name for many</FieldLabel>
      <FieldControl
        render={
          <Input
            color="module"
            value={draft.labelPlural}
            placeholder="Projects"
            onChange={(e) => {
              setPluralTouched(true);
              setDraft((d) => ({ ...d, labelPlural: e.target.value }));
            }}
          />
        }
      />
      <FieldDescription>
        Filled in from the name above. Change it for a word that does not simply take an
        &ldquo;s&rdquo;, or clear it if the word is the same either way.
      </FieldDescription>
    </Field>
  );
}

function LinkNameField({ ed }: { ed: ObjectTypeEditor }) {
  const { draft, setDraft, keyError } = ed;
  return (
    <Field>
      <FieldLabel>Short name for links</FieldLabel>
      <FieldControl
        render={
          <Input
            color="module"
            value={draft.key}
            placeholder="project"
            onChange={(e) => {
              setDraft((d) => ({ ...d, key: e.target.value }));
            }}
            onBlur={() => {
              setDraft((d) => ({
                ...d,
                key: d.key.trim() || keyFromLabel(d.label).toLowerCase(),
              }));
            }}
          />
        }
      />
      <FieldDescription>
        {keyError ??
          productCopy(
            'crm.objectType.key',
            'Used in web addresses and by anything connected to Piggles. It cannot be changed later.'
          )}
      </FieldDescription>
    </Field>
  );
}

function PurposeField({ ed }: { ed: ObjectTypeEditor }) {
  const { draft, setDraft } = ed;
  return (
    <Field>
      <FieldLabel>What it is for</FieldLabel>
      <FieldControl
        render={
          <Textarea
            color="module"
            rows={2}
            value={draft.description}
            placeholder="A piece of work we run for a customer, from the go-ahead to the final invoice."
            onChange={(e) => {
              setDraft((d) => ({ ...d, description: e.target.value }));
            }}
          />
        }
      />
    </Field>
  );
}
