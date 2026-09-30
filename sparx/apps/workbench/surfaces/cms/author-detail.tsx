'use client';

// One author — add them, then manage them.
//
// Adding and managing are the SAME surface in two states. `{ id: 'new' }` starts
// a blank author; `{ id }` edits an existing one. The two forms are identical,
// so making "new" a separate modal would mean building the same form twice and
// keeping them in sync forever — so it is one pane in two states, per the
// workbench rule.
//
// Explicit-save only: one Save button, last write wins. An unsaved edit registers
// the leave-guard, so closing or navigating away asks first.
//
// NOT built on EditorLayout: this is a short form — a name, a web address, a
// photo, a biography — with no second column to summarise. A bento would float a
// near-empty rail beside the work. One centred, capped column instead.

import { useEffect, useRef, useState } from 'react';
import {
  Button,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Heading,
  Input,
  Select,
  Text,
  Textarea,
  useToast,
} from '@wizeworks/silicaui-react';
import { useConfirm } from '../../lib/confirm';
import { Trash2 } from 'lucide-react';
import { useDirtySource } from '../../lib/workbench/dirty';
import { afterPaneChange } from '../../lib/defer';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { FormSection } from '../../components/form-section';
import { RefreshButton } from '../../components/refresh-button';
import type { SurfaceContext } from '../../lib/surfaces/registry';
// Read-only imports: the shared media browser, exactly as the content editor
// wraps its form and renders its asset fields.
import { MediaPickerProvider, AssetField } from './media-picker';
import { SaveFailure } from '@/components/save-failure';
// Read-only imports: the business's sites, and which one this window works in,
// so the byline's site can be named and changed.
import { useSites, type Site } from '../sites/data';
import { useActivePropertyId } from '../../lib/api/shell-data';
import {
  authorErrorMessage,
  authorName,
  useAuthor,
  useCreateAuthor,
  useDeleteAuthor,
  useUpdateAuthor,
  type Author,
} from './authors-data';
import { PaneLoadError } from '../../components/pane-load-error';

const COLUMN = 'mx-auto flex w-full max-w-2xl flex-col gap-4';

export function AuthorDetailSurface({ ctx }: { ctx: SurfaceContext }) {
  const id = typeof ctx.params.id === 'string' ? ctx.params.id : 'new';
  return id === 'new' ? <CreateAuthor ctx={ctx} /> : <EditAuthor ctx={ctx} id={id} />;
}

/* ── The shared field body ──────────────────────────────────────────────── */

interface Draft {
  name: string;
  slug: string;
  bio: string;
  /** The chosen photo's media asset id, or '' for none. */
  avatarAssetId: string;
  /** Which site the byline writes for: a site id, `ALL_SITES`, or '' for "the
   *  site this window is working in" (a new byline before the site list has
   *  loaded; the server resolves it from the site switcher). */
  site: string;
}

/** The Select's value for "every site". Not a uuid, so it cannot collide with a
 *  real site id. */
const ALL_SITES = 'all';

interface AuthorFieldsProps {
  draft: Draft;
  onChange: (patch: Partial<Draft>) => void;
  /** The byline as saved, or null while adding one. Lets the site field say
   *  what saving a move will do to THIS pane. */
  saved: Author | null;
}

/** Everything both the add and the manage views render, wrapped in the one media
 *  picker the photo field opens. */
function AuthorFields({ draft, onChange, saved }: AuthorFieldsProps) {
  return (
    <MediaPickerProvider source="content">
      <FormSection title="Name and web address">
        <Field>
          <FieldLabel>Name</FieldLabel>
          <FieldControl
            render={
              <Input
                color="module"
                value={draft.name}
                placeholder="Jane Doe"
                autoComplete="off"
                onChange={(event) => {
                  onChange({ name: event.target.value });
                }}
              />
            }
          />
          <FieldDescription>The name shown on everything they write.</FieldDescription>
        </Field>

        <Field>
          <FieldLabel>Web address</FieldLabel>
          <FieldControl
            render={
              <Input
                color="module"
                className="font-mono text-sm"
                value={draft.slug}
                placeholder="jane-doe"
                autoComplete="off"
                spellCheck={false}
                onChange={(event) => {
                  onChange({ slug: event.target.value });
                }}
              />
            }
          />
          <FieldDescription>
            Used in the address of their page on your site. Leave it blank and we will make one from
            the name.
          </FieldDescription>
        </Field>
      </FormSection>

      <FormSection
        title="Photo"
        description="A picture shown next to their name on what they write. Optional."
      >
        <AssetField
          value={draft.avatarAssetId}
          onChange={(next) => {
            onChange({ avatarAssetId: typeof next === 'string' ? next : '' });
          }}
        />
      </FormSection>

      <AuthorSiteScope draft={draft} onChange={onChange} saved={saved} />

      <FormSection
        title="Biography"
        description="A short paragraph about them, shown on their author page. Optional."
      >
        <Field>
          <FieldLabel>About them</FieldLabel>
          <FieldControl
            render={
              <Textarea
                color="module"
                rows={4}
                value={draft.bio}
                placeholder="A sentence or two on who they are and what they write about."
                onChange={(event) => {
                  onChange({ bio: event.target.value });
                }}
              />
            }
          />
        </Field>
      </FormSection>
    </MediaPickerProvider>
  );
}

/**
 * "Where this name appears": which one of the business's sites the byline
 * writes for, or all of them (issue 387).
 *
 * One site or every site, never a set, because that is what the record holds
 * (`Author.property_id`, a single nullable site). So this is a Select naming each
 * site, not the shared SiteScopeField's tick-list, which stores a LIST and would
 * promise a "these three sites" the byline cannot keep.
 *
 * Renders nothing for a business with one site: there is no choice to make, and
 * a control naming "sites" would invent one. Same rule SiteScopeField follows.
 */
function AuthorSiteScope({ draft, onChange, saved }: AuthorFieldsProps) {
  const { data: sites } = useSites();
  const activeSiteId = useActivePropertyId();
  if (!sites || sites.length <= 1) return null;

  // '' is "wherever this window is working", which the Select shows as that site.
  const value = draft.site === '' ? (activeSiteId ?? ALL_SITES) : draft.site;
  const items: Record<string, string> = { [ALL_SITES]: 'All my sites' };
  for (const site of sites) {
    items[site.id] = site.id === activeSiteId ? `${site.name} (the site you are in)` : site.name;
  }

  // Filing it under a DIFFERENT site takes it out of this site's author list,
  // which is the point, but a person should read that before pressing Save
  // rather than discover it as a pane that closed on her.
  const leaving = value !== ALL_SITES && value !== activeSiteId;
  const leavingTo = leaving ? siteName(sites, value) : null;
  const moved = saved !== null && value !== siteChoice(saved.property_id);

  return (
    <FormSection
      title="Where this name appears"
      description="You run more than one website. A name written for one of them stays out of the others' author lists, and out of the author choices on their posts."
    >
      <Field>
        <FieldLabel>Site this author writes for</FieldLabel>
        <Select
          color="module"
          aria-label="Which site this author writes for"
          value={value}
          items={items}
          onValueChange={(next) => {
            onChange({ site: String(next) });
          }}
        />
        <FieldDescription>
          {leavingTo
            ? saved === null
              ? `Once added, they will be in ${leavingTo}'s author list and not this site's. Switch to ${leavingTo} to find them.`
              : moved
                ? `Once you save, they move to ${leavingTo} and leave this site's author list. Switch to ${leavingTo} to edit them after that.`
                : `They write for ${leavingTo}.`
            : 'Choose “All my sites” when the same person writes for more than one of them. There is only ever one of each name, so this moves it rather than making a copy.'}
        </FieldDescription>
      </Field>
    </FormSection>
  );
}

/** A byline's `property_id` as the Select's value. */
function siteChoice(propertyId: string | null): string {
  return propertyId ?? ALL_SITES;
}

/** The Select's value as the wire's `property_id`: null is every site. */
function siteToWire(site: string): string | null {
  return site === ALL_SITES ? null : site;
}

function siteName(sites: readonly Site[] | undefined, id: string): string {
  return sites?.find((site) => site.id === id)?.name ?? 'another of your sites';
}

function emptyDraft(): Draft {
  // A new byline belongs to the site it was written on. The other default is
  // what put a magazine's masthead in a clothing shop's picker.
  return { name: '', slug: '', bio: '', avatarAssetId: '', site: '' };
}

function draftFrom(author: Author): Draft {
  return {
    name: author.display_name,
    slug: author.slug,
    bio: author.bio ?? '',
    avatarAssetId: author.avatar_asset_id ?? '',
    site: siteChoice(author.property_id),
  };
}

function serializeDraft(draft: Draft): string {
  return JSON.stringify({
    name: draft.name.trim(),
    slug: draft.slug.trim(),
    bio: draft.bio.trim(),
    avatarAssetId: draft.avatarAssetId,
    site: draft.site,
  });
}

/* ── Add ────────────────────────────────────────────────────────────────── */

function CreateAuthor({ ctx }: { ctx: SurfaceContext }) {
  const toast = useToast();
  const create = useCreateAuthor();
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const { data: sites } = useSites();
  const activeSiteId = useActivePropertyId();

  useEffect(() => {
    ctx.setTitle('New author');
  }, [ctx]);

  const patch = (next: Partial<Draft>) => {
    setDraft((current) => ({ ...current, ...next }));
  };

  const nameFilled = draft.name.trim() !== '';
  const dirty = !create.isSuccess && serializeDraft(draft) !== serializeDraft(emptyDraft());
  useDirtySource(dirty, 'You have started an author you have not saved. Close anyway?');

  const failure = create.isError
    ? authorErrorMessage(create.error, 'Could not add this author. Nothing was saved.')
    : null;

  const submit = () => {
    if (!nameFilled) return;
    create.mutate(
      {
        display_name: draft.name.trim(),
        ...(draft.slug.trim() ? { slug: draft.slug.trim() } : {}),
        ...(draft.bio.trim() ? { bio: draft.bio.trim() } : {}),
        ...(draft.avatarAssetId ? { avatar_asset_id: draft.avatarAssetId } : {}),
        // Omitted ('') lands it on the site being worked in: the server reads
        // that from the site switcher. Anything chosen is sent as chosen.
        ...(draft.site !== '' ? { property_id: siteToWire(draft.site) } : {}),
      },
      {
        onSuccess: (author) => {
          if (author.property_id !== null && author.property_id !== activeSiteId) {
            // Filed under another site, so this site cannot open it: the manage
            // view would load a byline this window is not allowed to see and
            // report it missing. Close instead, and say where it went.
            const where = siteName(sites, author.property_id);
            ctx.close();
            afterPaneChange(() => {
              toast.add({
                title: `${authorName(author)} added to ${where}`,
                description: `Switch to ${where} to see them in its author list.`,
                type: 'success',
              });
            });
            return;
          }
          // Becomes the manage view for the author that now exists — the same
          // pane, one state along. Toast follows the swap; see afterPaneChange.
          ctx.open('cms.authors.detail', { id: author.id }, { target: 'replace' });
          afterPaneChange(() => {
            toast.add({ title: `${authorName(author)} added`, type: 'success' });
          });
        },
      }
    );
  };

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar
        label="New author actions"
        primary={
          <Button
            color="module"
            size="sm"
            className="ml-auto"
            disabled={!nameFilled}
            loading={create.isPending}
            onClick={submit}
          >
            Add author
          </Button>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={COLUMN}>
          <div className="flex flex-col gap-1">
            <Heading level={1} className="text-2xl font-semibold">
              Add an author
            </Heading>
            <Text>
              An author is a name that appears on what you publish. Once added, you can pick them on
              any post.
            </Text>
          </div>

          <SaveFailure title="Could not add this author" message={failure} />

          <AuthorFields draft={draft} onChange={patch} saved={null} />
        </div>
      </div>
    </div>
  );
}

/* ── Edit / manage ──────────────────────────────────────────────────────── */

function EditAuthor({ ctx, id }: { ctx: SurfaceContext; id: string }) {
  const {
    data: author,
    isPending,
    isError,
    error,
    isFetching,
    dataUpdatedAt,
    refetch,
  } = useAuthor(id);

  const [draft, setDraft] = useState<Draft | null>(null);
  const initialRef = useRef<string>('');
  // Initialise ONCE per author id. Re-initialising on every refetch would wipe
  // an in-progress edit when a background refresh lands; Save resets the
  // snapshot itself (below), which is the only path that should.
  const initializedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!author) return;
    if (initializedFor.current === author.id) return;
    initializedFor.current = author.id;
    const next = draftFrom(author);
    setDraft(next);
    initialRef.current = serializeDraft(next);
  }, [author]);

  const dirty = draft !== null && serializeDraft(draft) !== initialRef.current;
  useDirtySource(dirty, 'You have unsaved changes to this author. Close anyway?');

  const displayName = draft ? draft.name.trim() : (author?.display_name ?? '');
  useEffect(() => {
    ctx.setTitle(displayName === '' ? 'Author' : displayName);
  }, [ctx, displayName]);

  if (isError) {
    // A failed load replaces the form — never an empty form beside a dead Save.
    return (
      <PaneLoadError
        error={error}
        noun="author"
        title="Could not load this author"
        description="This is a problem reaching the server. The author itself is unaffected."
        onRetry={() => {
          void refetch();
        }}
      />
    );
  }

  if (isPending || !author || !draft) {
    return (
      <p className="p-4 text-sm" role="status">
        Loading…
      </p>
    );
  }

  return (
    <ManageBody
      ctx={ctx}
      id={id}
      author={author}
      draft={draft}
      setDraft={setDraft}
      dirty={dirty}
      isFetching={isFetching}
      dataUpdatedAt={dataUpdatedAt}
      refetch={() => {
        void refetch();
      }}
      onSaved={(saved) => {
        const next = draftFrom(saved);
        setDraft(next);
        initialRef.current = serializeDraft(next);
      }}
    />
  );
}

interface ManageBodyProps {
  ctx: SurfaceContext;
  id: string;
  author: Author;
  draft: Draft;
  setDraft: (updater: (current: Draft | null) => Draft | null) => void;
  dirty: boolean;
  isFetching: boolean;
  dataUpdatedAt: number;
  refetch: () => void;
  onSaved: (saved: Author) => void;
}

function ManageBody({
  ctx,
  id,
  author,
  draft,
  setDraft,
  dirty,
  isFetching,
  dataUpdatedAt,
  refetch,
  onSaved,
}: ManageBodyProps) {
  const toast = useToast();
  const confirm = useConfirm();
  const update = useUpdateAuthor(id);
  const del = useDeleteAuthor(id);

  const patch = (next: Partial<Draft>) => {
    setDraft((current) => (current ? { ...current, ...next } : current));
  };

  const nameFilled = draft.name.trim() !== '';

  const { data: sites } = useSites();
  const activeSiteId = useActivePropertyId();
  // Sent ONLY when it actually changed. Omitted means "leave it where it is",
  // which is the right answer for every save that was about the name, the photo
  // or the biography.
  const siteChanged = draft.site !== '' && draft.site !== siteChoice(author.property_id);

  const save = () => {
    if (!nameFilled) return;
    update.mutate(
      {
        display_name: draft.name.trim(),
        // Only send a slug when there is one — an empty box means "leave the web
        // address as it is", not "clear it" (a slug is required and can't be
        // blank).
        ...(draft.slug.trim() ? { slug: draft.slug.trim() } : {}),
        bio: draft.bio.trim() ? draft.bio.trim() : null,
        avatar_asset_id: draft.avatarAssetId ? draft.avatarAssetId : null,
        ...(siteChanged ? { property_id: siteToWire(draft.site) } : {}),
      },
      {
        onSuccess: (saved) => {
          onSaved(saved);
          if (saved.property_id !== null && saved.property_id !== activeSiteId) {
            // Moved to another site, which this window cannot see into: every
            // read here is this site's bylines plus the shared ones, so the next
            // refetch would call it missing. Close, and say where it went.
            const where = siteName(sites, saved.property_id);
            ctx.close();
            afterPaneChange(() => {
              toast.add({
                title: `${authorName(saved)} moved to ${where}`,
                description: `Switch to ${where} to edit them from now on.`,
                type: 'success',
              });
            });
            return;
          }
          toast.add({ title: 'Saved', type: 'success' });
        },
        onError: (error) => {
          toast.add({
            title: 'Could not save',
            description: authorErrorMessage(error, 'Nothing was changed.'),
            type: 'error',
          });
        },
      }
    );
  };

  const onDelete = async () => {
    const ok = await confirm({
      title: `Delete ${authorName(author)}?`,
      // A shared byline is on every site, so its delete is too, and the owner
      // standing in one site should hear that before she confirms it.
      description:
        author.property_id === null && (sites ?? []).length > 1
          ? 'This removes this author for good, from every one of your sites, and cannot be undone. Anything they have written stays where it is, but their name comes off it on all of your sites.'
          : 'This removes this author for good and cannot be undone. Anything they have written stays on your site, but their name comes off it.',
      confirmLabel: 'Delete author',
      cancelLabel: 'Keep author',
      color: 'danger',
    });
    if (!ok) return;
    del.mutate(undefined, {
      onSuccess: () => {
        ctx.close();
        afterPaneChange(() => {
          toast.add({ title: `${authorName(author)} deleted`, type: 'success' });
        });
      },
      onError: (error) => {
        toast.add({
          title: 'Could not delete this author',
          description: authorErrorMessage(error, 'Nothing was changed.'),
          type: 'error',
        });
      },
    });
  };

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar
        label="Author actions"
        primary={
          <Button
            size="sm"
            color="module"
            className="ml-auto"
            disabled={!dirty || !nameFilled}
            loading={update.isPending}
            onClick={save}
          >
            Save
          </Button>
        }
        refresh={
          <RefreshButton isFetching={isFetching} updatedAt={dataUpdatedAt} onRefresh={refetch} />
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={COLUMN}>
          <AuthorFields draft={draft} onChange={patch} saved={author} />

          {/* Destructive action as a plain row under a divider, not a card with
              equal weight to the work above it. */}
          <div className="border-base-300 mt-2 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <div className="flex min-w-0 flex-col">
              <Text className="font-medium">Delete this author</Text>
              <Text className="text-sm">
                Removes them for good. Their name comes off anything they have written; the writing
                itself stays.
              </Text>
            </div>
            <Button
              size="sm"
              variant="outline"
              color="danger"
              loading={del.isPending}
              onClick={() => {
                void onDelete();
              }}
            >
              <Trash2 className="size-4" aria-hidden />
              Delete
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
