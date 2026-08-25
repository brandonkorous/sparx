'use client';

// What the group is called, where it lives, and how it is described.

import {
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  FieldStatus,
  Input,
  Switch,
  Textarea,
} from '@wizeworks/silicaui-react';
import { FormSection } from '../../components/form-section';
import { slugifyTyping } from '../../lib/slugify';
import type { Draft } from './collection-draft';

export function CollectionBasics({
  draft,
  set,
  effectiveHandle,
  setHandleTouched,
  nameError,
  touched,
}: {
  draft: Draft;
  set: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
  effectiveHandle: string;
  setHandleTouched: (next: boolean) => void;
  nameError: string | null;
  touched: boolean;
}) {
  return (
    <FormSection title="Name">
      <Field>
        <FieldLabel>Name</FieldLabel>
        <FieldControl
          render={
            <Input
              color={nameError && touched ? 'error' : 'module'}
              value={draft.name}
              placeholder="Summer sale"
              onChange={(event) => {
                set('name', event.target.value);
              }}
            />
          }
        />
        {nameError && touched ? (
          <FieldStatus status="error">{nameError}</FieldStatus>
        ) : (
          <FieldDescription>What shoppers see at the top of the group.</FieldDescription>
        )}
      </Field>

      <Field>
        <FieldLabel>Web address</FieldLabel>
        <FieldControl
          render={
            <Input
              color="module"
              value={effectiveHandle}
              placeholder="summer-sale"
              spellCheck={false}
              autoComplete="off"
              onChange={(event) => {
                setHandleTouched(true);
                // Keeps a hyphen she just pressed; tidied on save (issue #181).
                set('handle', slugifyTyping(event.target.value, 120));
              }}
            />
          }
        />
        <FieldDescription>
          The end of this group&apos;s page address — yoursite.com/collections/
          {effectiveHandle || '…'}.
        </FieldDescription>
      </Field>

      <Field>
        <FieldLabel>Description</FieldLabel>
        <FieldControl
          render={
            <Textarea
              color="module"
              rows={3}
              value={draft.description}
              placeholder="A line or two shown at the top of the group."
              onChange={(event) => {
                set('description', event.target.value);
              }}
            />
          }
        />
      </Field>

      <Field>
        <FieldLabel>Feature this group</FieldLabel>
        <FieldControl
          render={
            <Switch
              color="module"
              checked={draft.featured}
              onCheckedChange={(next: boolean) => {
                set('featured', next);
              }}
            />
          }
        />
        <FieldDescription>
          Marks it as one to highlight. Your site can show the ones you feature on its home page.
        </FieldDescription>
      </Field>
    </FormSection>
  );
}
