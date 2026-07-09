'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useConfirm } from '@sparx/ui';
import {
  Button,
  Card,
  CardActions,
  CardBody,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  FieldStatus,
  Textarea,
} from '@wizeworks/silicaui-react';
import { rule, useFieldValidation } from '@sparx/forms';
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
  const [message, setMessage] = React.useState<string | null>(null);

  // Controlled fields drive live validation via `useFieldValidation`; dirtiness
  // derives from comparing against the saved author. Registering it lets the
  // detail page's guarded back-link / presentation switch confirm before
  // discarding unsaved author edits (docs/105).
  const [displayName, setDisplayName] = React.useState(author.displayName);
  const [slug, setSlug] = React.useState(author.slug);
  const [bio, setBio] = React.useState(author.bio);

  const v = useFieldValidation(
    { display_name: displayName, slug },
    {
      display_name: rule.required('Display name is required.'),
      slug: rule.required('Slug is required.'),
    }
  );

  const dirty = displayName !== author.displayName || slug !== author.slug || bio !== author.bio;
  useUnsavedGuard(dirty, { kind: 'edit', noun: 'author' });

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (!v.validate()) return;
    const data = new FormData();
    data.append('display_name', displayName.trim());
    data.append('slug', slug.trim());
    data.append('bio', bio);
    startTransition(async () => {
      const result = await updateAuthor(author.id, data);
      if (!result.ok) {
        const msg = result.error ?? 'Could not save author.';
        if (result.field === 'slug' || result.field === 'display_name') {
          v.setServerErrors({ [result.field]: msg });
        } else {
          setError(msg);
        }
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

  return (
    <form onSubmit={onSubmit} noValidate>
      <div className="flex flex-col gap-5">
        <Card>
          <CardBody>
            <h3 className="text-xl font-semibold">Details</h3>
            <div className="flex flex-col gap-4">
              <Field {...v.field('display_name')}>
                <FieldLabel required>Display name</FieldLabel>
                <FieldControl
                  name="display_name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  {...v.control('display_name')}
                />
              </Field>
              <Field {...v.field('slug')}>
                <FieldLabel required>Slug</FieldLabel>
                <FieldControl
                  name="slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  {...v.control('slug')}
                />
                {!v.visibleError('slug') && (
                  <FieldDescription>Unique per tenant — used in author URLs.</FieldDescription>
                )}
              </Field>
              <Field>
                <FieldLabel>Bio</FieldLabel>
                <FieldControl
                  name="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  render={<Textarea rows={4} />}
                />
              </Field>
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
        </Card>
      </div>
    </form>
  );
}
