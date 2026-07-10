'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { AdaptiveLabel, toast, useConfirm } from '@sparx/ui';
import {
  Button,
  Card,
  CardBody,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Textarea,
  Tooltip,
} from '@wizeworks/silicaui-react';
import { rule, useFieldValidation } from '@sparx/forms';
import { Check, Trash2 } from 'lucide-react';
import { deleteAuthor, updateAuthor } from '../actions';
import { DetailFooterSlot, DetailHeaderSlot } from '../../../_components/detail-header-slot';
import { useUnsavedGuard } from '../../../_components/unsaved-guard';

const FORM_ID = 'author-edit-form';

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
  const [savedAt, setSavedAt] = React.useState<number | null>(null);

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
    setSavedAt(null);
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
          toast.error(msg);
        }
        return;
      }
      setSavedAt(Date.now());
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
    startTransition(async () => {
      const result = await deleteAuthor(author.id);
      if (!result.ok) {
        toast.error(result.error ?? 'Could not delete.');
        return;
      }
      router.push('/cms/authors');
      router.refresh();
    });
  }

  return (
    <form id={FORM_ID} onSubmit={onSubmit} noValidate>
      {/* Delete is rare + destructive, so it's demoted the same way Page demotes
          it: icon-only ghost + tooltip in the shared detail chrome's header. */}
      <DetailHeaderSlot>
        <Tooltip content="Delete">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Delete"
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
        </Card>
      </div>

      {/* The primary action teleports up into the shared detail chrome's footer
          (next to Delete), not floored at the bottom — a failed save surfaces as
          a toast since there's no room for a persistent error line there. */}
      <DetailFooterSlot>
        <div className="flex items-center gap-2">
          {savedAt !== null && !dirty && (
            <span className="text-success flex items-center gap-1 text-xs">
              <Check className="h-3.5 w-3.5" />
              Saved
            </span>
          )}
          <Button
            type="submit"
            form={FORM_ID}
            size="sm"
            color="module"
            disabled={pending || !dirty}
            loading={pending}
          >
            <AdaptiveLabel label={{ full: 'Save changes', short: 'Save' }} />
          </Button>
        </div>
      </DetailFooterSlot>
    </form>
  );
}
