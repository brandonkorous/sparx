'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@sparx/ui';
import {
  Button,
  Card,
  CardActions,
  CardBody,
  EmptyState,
  Field,
  FieldControl,
  FieldLabel,
  FieldStatus,
  Select,
  Textarea,
} from '@wizeworks/silicaui-react';
import { rule, useFieldValidation } from '@sparx/forms';
import { ListTree, Plus, Trash2 } from 'lucide-react';
import { createTerm, deleteTerm } from '../actions';

export interface Term {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  parent_term_id: string | null;
}

export function TermsManager({
  taxonomyKey,
  hierarchical,
  terms,
}: {
  taxonomyKey: string;
  hierarchical: boolean;
  terms: Term[];
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [parentId, setParentId] = React.useState('');
  const [name, setName] = React.useState('');
  const [slug, setSlug] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [pendingDelete, setPendingDelete] = React.useState<Term | null>(null);

  const v = useFieldValidation({ name }, { name: rule.required('Name is required.') });

  // Resolve a term's `parent_term_id` to the parent's name (all terms are in
  // scope here) so the tree reads as names, not raw ids.
  const termNameById = new Map(terms.map((t) => [t.id, t.name]));

  function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (!v.validate()) return;
    const data = new FormData();
    data.set('name', name.trim());
    if (slug.trim()) data.set('slug', slug.trim());
    data.set('description', description);
    // Select writes to React state, not FormData.
    if (parentId) data.set('parent_term_id', parentId);
    startTransition(async () => {
      const result = await createTerm(taxonomyKey, data);
      if (!result.ok) {
        setError(result.error ?? 'Could not create term.');
        return;
      }
      setName('');
      setSlug('');
      setDescription('');
      setParentId('');
      setMessage('Term created.');
      router.refresh();
    });
  }

  function executeDelete() {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setPendingDelete(null);
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await deleteTerm(taxonomyKey, target.id);
      if (!result.ok) {
        setError(result.error ?? 'Could not delete term.');
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardBody>
          <h3 className="text-xl font-semibold">Add term</h3>
          <p className="opacity-70">
            Slug auto-derives from the name when blank.
            {hierarchical && (
              <>
                {' '}
                Pick <em>(top level)</em> for a root-level term.
              </>
            )}
          </p>
          <form onSubmit={onCreate}>
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
                <Field className="flex-1">
                  <FieldLabel>Slug (optional)</FieldLabel>
                  <FieldControl
                    name="slug"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                  />
                </Field>
                {hierarchical && (
                  <Field className="flex-1">
                    <FieldLabel>Parent</FieldLabel>
                    <Select
                      id="parent_term_id"
                      aria-label="Parent term"
                      value={parentId || 'top'}
                      onValueChange={(val) => setParentId(val === 'top' ? '' : (val as string))}
                      items={{
                        top: '— (top level)',
                        ...Object.fromEntries(terms.map((t) => [t.id, t.name])),
                      }}
                    />
                  </Field>
                )}
              </div>
              <Field>
                <FieldLabel>Description</FieldLabel>
                <FieldControl
                  name="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  render={<Textarea rows={2} />}
                />
              </Field>
            </div>
            <CardActions>
              <div className="flex flex-row items-center gap-3">
                <Button
                  type="submit"
                  color="module"
                  iconStart={<Plus className="h-4 w-4" />}
                  disabled={pending}
                  loading={pending}
                >
                  Add term
                </Button>
                {error && (
                  <FieldStatus status="error" attached={false} role="alert" aria-live="polite">
                    {error}
                  </FieldStatus>
                )}
                {message && (
                  <FieldStatus status="success" attached={false} aria-live="polite">
                    {message}
                  </FieldStatus>
                )}
              </div>
            </CardActions>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <h3 className="text-xl font-semibold">Terms</h3>
          {terms.length === 0 ? (
            <EmptyState
              icon={<ListTree className="h-5 w-5" />}
              title="No terms yet"
              description="Add your first term above. Tagging entries with a term groups them on storefront index pages and feeds."
            />
          ) : (
            <div className="flex flex-col gap-2">
              {terms.map((t) => (
                <div
                  key={t.id}
                  className="border-base-300 flex flex-row items-center justify-between gap-4 rounded-md border px-3 py-2"
                >
                  <div className="flex flex-col gap-0">
                    <p className="text-sm">{t.name}</p>
                    <p className="text-base-content text-xs">
                      <code>{t.slug}</code>
                      {t.parent_term_id
                        ? ` · parent ${termNameById.get(t.parent_term_id) ?? t.parent_term_id.slice(0, 8)}`
                        : ''}
                      {t.description ? ` · ${t.description.slice(0, 60)}` : ''}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    iconStart={<Trash2 className="h-3 w-3" />}
                    onClick={() => setPendingDelete(t)}
                    disabled={pending}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(next) => {
          if (!next) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete term?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{pendingDelete?.name}</strong> will be removed. Entries currently tagged with
              it will be untagged — they stay published, but the term link is dropped.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={executeDelete}>Delete term</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
