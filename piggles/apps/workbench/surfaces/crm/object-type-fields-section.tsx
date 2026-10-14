'use client';

// "The details you track" and "Which detail names the record" sections.

import {
  Alert,
  Button,
  Field,
  FieldControl,
  FieldLabel,
  NativeSelect,
} from '@wizeworks/silicaui-react';
import { faPlus } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { FormSection } from '../../components/form-section';
import { productCopy } from '../../lib/product';
import { FieldRow } from './object-type-field-row';
import type { ObjectTypeEditor } from './use-object-type-editor';

export function ObjectTypeFieldsSection({ ed }: { ed: ObjectTypeEditor }) {
  const { draft, duplicateKeys, addField } = ed;
  return (
    <FormSection
      title="The details you track"
      description={productCopy(
        'crm.objectType.customFields',
        'Add anything you keep about these records that Piggles does not already ask for.'
      )}
    >
      {duplicateKeys.size > 0 ? (
        <Alert color="danger" variant="soft">
          Two details share the same short name. Give each one its own, or one will overwrite the
          other.
        </Alert>
      ) : null}

      {draft.fields.length === 0 ? (
        <p className="py-4 text-sm">
          Nothing extra yet. Whatever you keep on a sticky note or a spare column in a spreadsheet
          belongs here.
        </p>
      ) : (
        <DraftFieldList ed={ed} />
      )}

      <Button size="sm" color="module" variant="outline" onClick={addField}>
        <Icon glyph={faPlus} className="size-4" aria-hidden />
        Add a detail
      </Button>
    </FormSection>
  );
}

function DraftFieldList({ ed }: { ed: ObjectTypeEditor }) {
  const { draft, duplicateKeys, expanded, setExpanded, setField, moveField, removeField } = ed;
  return (
    <div className="flex flex-col gap-2">
      {draft.fields.map(({ uid, field }, index) => (
        <FieldRow
          key={uid}
          field={field}
          index={index}
          total={draft.fields.length}
          duplicate={duplicateKeys.has(field.key)}
          expanded={expanded === uid}
          onToggle={() => {
            setExpanded((e) => (e === uid ? null : uid));
          }}
          onChange={(next) => {
            setField(index, next);
          }}
          onMove={(direction) => {
            moveField(index, direction);
          }}
          onRemove={() => {
            void removeField(index);
          }}
        />
      ))}
    </div>
  );
}

export function ObjectTypePrimarySection({ ed }: { ed: ObjectTypeEditor }) {
  const { draft, setDraft } = ed;
  return (
    <FormSection
      title="Which detail names the record"
      description="The one shown in lists and search results, the way a customer's name is."
    >
      <Field>
        <FieldLabel>Name it by</FieldLabel>
        <FieldControl
          render={
            <NativeSelect
              color="module"
              value={draft.primaryFieldKey}
              onChange={(e) => {
                setDraft((d) => ({ ...d, primaryFieldKey: e.target.value }));
              }}
            >
              <option value="">Nothing, just show when it was added</option>
              {draft.fields
                .filter(({ field }) => field.type === 'text' || field.type === 'number')
                .map(({ uid, field }) => (
                  <option key={uid} value={field.key}>
                    {field.label}
                  </option>
                ))}
            </NativeSelect>
          }
        />
      </Field>
    </FormSection>
  );
}
