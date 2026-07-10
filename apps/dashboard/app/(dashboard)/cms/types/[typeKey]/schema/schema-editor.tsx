'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { AdaptiveLabel, toast, useConfirm } from '@sparx/ui';
import {
  Button,
  Card,
  CardBody,
  Checkbox,
  Field,
  FieldControl,
  FieldLabel,
  FieldStatus,
  Label,
  Textarea,
  Tooltip,
} from '@wizeworks/silicaui-react';
import { rule, useFieldValidation } from '@sparx/forms';
import { Trash2 } from 'lucide-react';
import { deleteContentType, updateContentType } from '../../actions';
import { DetailFooterSlot, DetailHeaderSlot } from '../../../../_components/detail-header-slot';

const FORM_ID = 'content-type-schema-form';

export interface SchemaEditorInitial {
  name: string;
  pluralName: string;
  description: string;
  urlPattern: string;
  isSingleton: boolean;
  schemaText: string;
}

export function SchemaEditor({
  typeKey,
  initial,
}: {
  typeKey: string;
  initial: SchemaEditorInitial;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, startTransition] = React.useTransition();
  const [name, setName] = React.useState(initial.name);
  const [pluralName, setPluralName] = React.useState(initial.pluralName);
  const [schemaText, setSchemaText] = React.useState(initial.schemaText);
  const [isSingleton, setIsSingleton] = React.useState(initial.isSingleton);
  const [hint, setHint] = React.useState<string | null>(null);

  const v = useFieldValidation(
    { name, plural_name: pluralName },
    {
      name: rule.required('Name is required.'),
      plural_name: rule.required('Plural is required.'),
    }
  );

  React.useEffect(() => {
    try {
      const parsed: unknown = JSON.parse(schemaText);
      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        !Array.isArray((parsed as { fields?: unknown }).fields)
      ) {
        setHint('Schema must be a JSON object with a `fields` array.');
        return;
      }
      const count = (parsed as { fields: unknown[] }).fields.length;
      setHint(`Looks good — ${count} field${count === 1 ? '' : 's'}.`);
    } catch {
      setHint('JSON is malformed — fix syntax before saving.');
    }
  }, [schemaText]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!v.validate()) return;
    const data = new FormData(e.currentTarget);
    data.set('schema', schemaText);
    // <Checkbox> writes to React state, not native FormData — inject value
    // before the server action reads.
    if (isSingleton) data.set('is_singleton', 'on');
    else data.delete('is_singleton');
    startTransition(async () => {
      const result = await updateContentType(typeKey, data);
      if (!result.ok) {
        toast.error(result.error ?? 'Could not save schema.');
        return;
      }
      toast.success('Schema saved.');
      router.refresh();
    });
  }

  async function handleDelete() {
    const ok = await confirm({
      title: `Delete the "${typeKey}" content type?`,
      description: (
        <>
          This removes the schema definition. If any entries still use this type the API will reject
          the deletion — you&apos;ll need to archive those entries first.
        </>
      ),
      confirmLabel: 'Delete type',
      tone: 'danger',
    });
    if (!ok) return;
    startTransition(async () => {
      const result = await deleteContentType(typeKey);
      if (!result.ok) {
        toast.error(result.error ?? 'Could not delete type.');
        return;
      }
      toast.success(`Deleted content type "${typeKey}".`);
      router.push('/cms/types');
      router.refresh();
    });
  }

  return (
    <form id={FORM_ID} onSubmit={onSubmit} noValidate>
      {/* Delete is rare + destructive, so it's demoted the same way Page/Author
          demote it: icon-only ghost + tooltip in the shared detail chrome's
          header (drawer/modal chrome or the full-page shell). */}
      <DetailHeaderSlot>
        <Tooltip content="Delete type">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Delete type"
            disabled={pending}
            onClick={() => void handleDelete()}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </Tooltip>
      </DetailHeaderSlot>

      <div className="flex flex-col gap-5">
        <Card>
          <CardBody>
            <h3 className="text-xl font-semibold">Identity</h3>
            <p className="opacity-70">The key is immutable. Name and labels can change freely.</p>
            <div className="flex flex-col gap-4">
              <div className="flex flex-row gap-3">
                <Field {...v.field('name')} className="flex-1">
                  <FieldLabel required>Name</FieldLabel>
                  <FieldControl
                    name="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    {...v.control('name')}
                  />
                </Field>
                <Field {...v.field('plural_name')} className="flex-1">
                  <FieldLabel required>Plural</FieldLabel>
                  <FieldControl
                    name="plural_name"
                    value={pluralName}
                    onChange={(e) => setPluralName(e.target.value)}
                    {...v.control('plural_name')}
                  />
                </Field>
              </div>
              <Field>
                <FieldLabel>Description</FieldLabel>
                <FieldControl
                  name="description"
                  defaultValue={initial.description}
                  render={<Textarea rows={2} />}
                />
              </Field>
              <div className="flex flex-row gap-3">
                <Field className="flex-1">
                  <FieldLabel>URL pattern</FieldLabel>
                  <FieldControl
                    name="url_pattern"
                    defaultValue={initial.urlPattern}
                    placeholder="/case-studies/{slug}"
                  />
                </Field>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="is_singleton">Singleton</Label>
                  <div className="flex flex-row items-center gap-2">
                    <Checkbox
                      id="is_singleton"
                      checked={isSingleton}
                      onChange={(e) => setIsSingleton(e.target.checked)}
                    />
                    <p className="text-base-content/70 text-xs">Only one entry can exist.</p>
                  </div>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <h3 className="text-xl font-semibold">Schema JSON</h3>
            <p className="opacity-70">
              Same FieldDef union the platform validators use. Saving an invalid schema gets
              rejected with the validation error.
            </p>
            <Field>
              <Textarea
                value={schemaText}
                onChange={(e) => setSchemaText(e.target.value)}
                rows={24}
                className="font-mono text-xs"
                aria-label="Schema JSON"
              />
              {hint &&
                (hint.startsWith('Looks good') ? (
                  <FieldStatus status="success" attached={false} aria-live="polite">
                    {hint}
                  </FieldStatus>
                ) : (
                  <FieldStatus status="error" attached={false} aria-live="polite">
                    {hint}
                  </FieldStatus>
                ))}
            </Field>
          </CardBody>
        </Card>
      </div>

      {/* The primary action teleports up into the shared detail chrome's footer
          (next to Delete), not floored at the bottom — a failed save surfaces as
          a toast since there's no room for a persistent error line there. */}
      <DetailFooterSlot>
        <Button
          type="submit"
          form={FORM_ID}
          size="sm"
          color="module"
          disabled={pending}
          loading={pending}
        >
          <AdaptiveLabel label={{ full: 'Save schema', short: 'Save' }} />
        </Button>
      </DetailFooterSlot>
    </form>
  );
}
