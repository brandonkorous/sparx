'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast, useConfirm } from '@sparx/ui';
import {
  Button,
  Card,
  CardActions,
  CardBody,
  Checkbox,
  Input,
  Label,
  Textarea,
} from 'silicaui-react';
import { Save, Trash2 } from 'lucide-react';
import { deleteContentType, updateContentType } from '../../actions';

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
  const [error, setError] = React.useState<string | null>(null);
  const [schemaText, setSchemaText] = React.useState(initial.schemaText);
  const [isSingleton, setIsSingleton] = React.useState(initial.isSingleton);
  const [hint, setHint] = React.useState<string | null>(null);

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
    setError(null);
    const data = new FormData(e.currentTarget);
    data.set('schema', schemaText);
    // <Checkbox> writes to React state, not native FormData — inject value
    // before the server action reads.
    if (isSingleton) data.set('is_singleton', 'on');
    else data.delete('is_singleton');
    startTransition(async () => {
      const result = await updateContentType(typeKey, data);
      if (!result.ok) {
        setError(result.error ?? 'Could not save schema.');
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
    setError(null);
    startTransition(async () => {
      const result = await deleteContentType(typeKey);
      if (!result.ok) {
        setError(result.error ?? 'Could not delete type.');
        return;
      }
      toast.success(`Deleted content type "${typeKey}".`);
      router.push('/cms/types');
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <div className="flex flex-col gap-5">
        <Card>
          <CardBody>
            <h3 className="text-xl font-semibold">Identity</h3>
            <p className="opacity-70">The key is immutable. Name and labels can change freely.</p>
            <div className="flex flex-col gap-4">
              <div className="flex flex-row gap-3">
                <div className="flex flex-1 flex-col gap-1">
                  <Label htmlFor="name">
                    Name{' '}
                    <span className="text-error" aria-hidden="true">
                      *
                    </span>
                  </Label>
                  <Input id="name" name="name" defaultValue={initial.name} required aria-required />
                </div>
                <div className="flex flex-1 flex-col gap-1">
                  <Label htmlFor="plural_name">
                    Plural{' '}
                    <span className="text-error" aria-hidden="true">
                      *
                    </span>
                  </Label>
                  <Input
                    id="plural_name"
                    name="plural_name"
                    defaultValue={initial.pluralName}
                    required
                    aria-required
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  defaultValue={initial.description}
                  rows={2}
                />
              </div>
              <div className="flex flex-row gap-3">
                <div className="flex flex-1 flex-col gap-1">
                  <Label htmlFor="url_pattern">URL pattern</Label>
                  <Input
                    id="url_pattern"
                    name="url_pattern"
                    defaultValue={initial.urlPattern}
                    placeholder="/case-studies/{slug}"
                  />
                </div>
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
            <div className="flex flex-col gap-2">
              <Textarea
                value={schemaText}
                onChange={(e) => setSchemaText(e.target.value)}
                rows={24}
                className="font-mono text-xs"
                aria-label="Schema JSON"
              />
              {hint && (
                <p
                  className={`text-xs ${
                    hint.startsWith('Looks good') ? 'text-base-content/70' : 'text-danger'
                  }`}
                  aria-live="polite"
                >
                  {hint}
                </p>
              )}
            </div>
            <CardActions>
              <div className="flex flex-row items-center gap-3">
                <Button
                  type="submit"
                  color="module"
                  iconStart={<Save className="h-4 w-4" />}
                  disabled={pending}
                  loading={pending}
                >
                  Save schema
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  iconStart={<Trash2 className="h-4 w-4" />}
                  onClick={handleDelete}
                  disabled={pending}
                >
                  Delete type
                </Button>
                {error && (
                  <p className="text-danger text-sm" role="alert" aria-live="polite">
                    {error}
                  </p>
                )}
              </div>
            </CardActions>
          </CardBody>
        </Card>
      </div>
    </form>
  );
}
