'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useConfirm } from '@sparx/ui';
import { Button, Card, CardActions, CardBody, Input, Label, Textarea } from 'silicaui-react';
import { Save, Trash2 } from 'lucide-react';
import { deleteAuthor, updateAuthor } from '../actions';
import { useUnsavedGuard } from '../../../_components/unsaved-guard';

export interface EditableAuthor {
  id: string;
  displayName: string;
  slug: string;
  bio: string;
}

export function AuthorEditForm({ author }: { author: EditableAuthor }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [errorField, setErrorField] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  // The fields are an uncontrolled native form (read via FormData on submit), so
  // dirtiness is recomputed from the live form on every input. Registering it lets
  // the detail page's guarded back-link / presentation switch confirm before
  // discarding unsaved author edits (docs/105).
  const formRef = React.useRef<HTMLFormElement>(null);
  const [dirty, setDirty] = React.useState(false);
  const recomputeDirty = React.useCallback(() => {
    const form = formRef.current;
    if (!form) return;
    const data = new FormData(form);
    const val = (k: string) => {
      const v = data.get(k);
      return typeof v === 'string' ? v : '';
    };
    setDirty(
      val('display_name') !== author.displayName ||
        val('slug') !== author.slug ||
        val('bio') !== author.bio
    );
  }, [author]);
  useUnsavedGuard(dirty, { kind: 'edit', noun: 'author' });

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setErrorField(null);
    setMessage(null);
    const data = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await updateAuthor(author.id, data);
      if (!result.ok) {
        setError(result.error ?? 'Could not save author.');
        setErrorField(result.field ?? null);
        return;
      }
      setMessage('Saved.');
      router.refresh();
    });
  }

  async function handleDelete() {
    const ok = await confirm({
      title: 'Delete author?',
      description: (
        <>
          <strong>{author.displayName}</strong> will be removed. Any posts attributed to this author
          will keep their byline as a frozen string but lose the link back to the author record.
        </>
      ),
      confirmLabel: 'Delete author',
      tone: 'danger',
    });
    if (!ok) return;
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await deleteAuthor(author.id);
      if (!result.ok) {
        setError(result.error ?? 'Could not delete.');
        return;
      }
      router.push('/cms/authors');
      router.refresh();
    });
  }

  const slugError = errorField === 'slug' ? error : null;
  const generalError = errorField ? null : error;

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      onInput={recomputeDirty}
      onChange={recomputeDirty}
      noValidate
    >
      <div className="flex flex-col gap-5">
        <Card>
          <CardBody>
            <h3 className="text-xl font-semibold">Details</h3>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <Label htmlFor="display_name">
                  Display name{' '}
                  <span className="text-error" aria-hidden="true">
                    *
                  </span>
                </Label>
                <Input
                  id="display_name"
                  name="display_name"
                  defaultValue={author.displayName}
                  required
                  aria-required
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="slug">
                  Slug{' '}
                  <span className="text-error" aria-hidden="true">
                    *
                  </span>
                </Label>
                <Input
                  id="slug"
                  name="slug"
                  defaultValue={author.slug}
                  required
                  aria-required
                  aria-invalid={slugError ? true : undefined}
                  aria-describedby={slugError ? 'slug-error' : undefined}
                />
                {slugError ? (
                  <p
                    id="slug-error"
                    className="text-danger text-xs"
                    role="alert"
                    aria-live="polite"
                  >
                    {slugError}
                  </p>
                ) : (
                  <p className="text-base-content/70 text-xs">
                    Unique per tenant — used in author URLs.
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="bio">Bio</Label>
                <Textarea id="bio" name="bio" defaultValue={author.bio} rows={4} />
              </div>
            </div>
          </CardBody>
          <CardActions>
            <div className="flex flex-row items-center gap-3">
              <Button
                type="submit"
                color="module"
                iconStart={<Save className="h-4 w-4" />}
                disabled={pending}
                loading={pending}
              >
                Save changes
              </Button>
              <Button
                type="button"
                variant="ghost"
                iconStart={<Trash2 className="h-4 w-4" />}
                onClick={handleDelete}
                disabled={pending}
              >
                Delete
              </Button>
              {generalError && (
                <p className="text-danger text-sm" role="alert" aria-live="polite">
                  {generalError}
                </p>
              )}
              {message && (
                <p className="text-success text-sm" aria-live="polite">
                  {message}
                </p>
              )}
            </div>
          </CardActions>
        </Card>
      </div>
    </form>
  );
}
