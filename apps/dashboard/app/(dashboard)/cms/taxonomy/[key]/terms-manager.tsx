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
  Input,
  Label,
  Select,
  Textarea,
} from 'silicaui-react';
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
  const [pendingDelete, setPendingDelete] = React.useState<Term | null>(null);

  // Resolve a term's `parent_term_id` to the parent's name (all terms are in
  // scope here) so the tree reads as names, not raw ids.
  const termNameById = new Map(terms.map((t) => [t.id, t.name]));

  function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    const form = e.currentTarget;
    const data = new FormData(form);
    // Select writes to React state, not FormData.
    if (parentId) data.set('parent_term_id', parentId);
    else data.delete('parent_term_id');
    startTransition(async () => {
      const result = await createTerm(taxonomyKey, data);
      if (!result.ok) {
        setError(result.error ?? 'Could not create term.');
        return;
      }
      form.reset();
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
                <div className="flex flex-1 flex-col gap-1">
                  <Label htmlFor="name">
                    Name{' '}
                    <span className="text-error" aria-hidden="true">
                      *
                    </span>
                  </Label>
                  <Input id="name" name="name" required aria-required />
                </div>
                <div className="flex flex-1 flex-col gap-1">
                  <Label htmlFor="slug">Slug (optional)</Label>
                  <Input id="slug" name="slug" />
                </div>
                {hierarchical && (
                  <div className="flex flex-1 flex-col gap-1">
                    <Label htmlFor="parent_term_id">Parent</Label>
                    <Select
                      id="parent_term_id"
                      aria-label="Parent term"
                      value={parentId || 'top'}
                      onValueChange={(v) => setParentId(v === 'top' ? '' : (v as string))}
                      items={{
                        top: '— (top level)',
                        ...Object.fromEntries(terms.map((t) => [t.id, t.name])),
                      }}
                    />
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" name="description" rows={2} />
              </div>
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
                  <p className="text-danger text-sm" role="alert" aria-live="polite">
                    {error}
                  </p>
                )}
                {message && (
                  <p className="text-success text-sm" aria-live="polite">
                    {message}
                  </p>
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
                  className="flex flex-row items-center justify-between gap-4 rounded-md border border-[var(--color-border-default)] px-3 py-2"
                >
                  <div className="flex flex-col gap-0">
                    <p className="text-sm">{t.name}</p>
                    <p className="text-base-content/70 text-xs">
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
