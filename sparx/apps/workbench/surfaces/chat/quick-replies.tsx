'use client';

// Quick replies — the saved answers your team can send with one click from a
// conversation.
//
// Authoring and managing them is ONE pane, not a list plus a create modal: there
// is no per-reply detail surface to return to, and keeping the compose form in
// the pane means a half-written reply is tracked as unsaved work like everything
// else here — abandon the pane with text in the box and it asks first. (A modal
// would be invisible to that safety net.)
//
// A reply can belong to THIS site or to every site you run (docs/131 §3.7): a
// note about fresh-baked donuts has no place in a machine-shop thread, but plenty
// of replies ("thanks, one moment") are genuinely generic. This site is the
// default, so business-specific copy stays with its business unless you say
// otherwise.

import { useEffect, useRef, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
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
import { MessageSquareText, Pencil, Plus, Trash2 } from 'lucide-react';
import { useConfirm } from '../../lib/confirm';
import { useDirtySource } from '../../lib/workbench/dirty';
import { afterPaneChange } from '../../lib/defer';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { FormSection } from '../../components/form-section';
import { RefreshButton } from '../../components/refresh-button';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { useSites } from '../sites/data';
// The sentences that reckon with which of her businesses a reply belongs to (a
// business with ONE site reads none of them), and the ones that carry changing a
// reply rather than deleting it and typing it again.
import {
  changedReplyFields,
  deleteReplyWarning,
  editFormWords,
  fixedShortcutNote,
  isSharedReply,
  replyScopeNote,
  savedReplyWords,
  scopeOf,
  shortcutIsFixed,
} from './quick-reply-words';
import {
  chatErrorMessage,
  useCreateQuickReply,
  useDeleteQuickReply,
  useQuickReplies,
  useUpdateQuickReply,
  type QuickReply,
} from './data';
// Which of her sites "This site only" means. Null while the read is in flight,
// and a null is left OUT of the comparison rather than guessed — a guess here
// moves a reply between her businesses without her asking.
import { useActivePropertyId } from '../../lib/api/shell-data';

const COLUMN = 'mx-auto flex w-full max-w-3xl flex-col gap-4';

type Scope = 'site' | 'all';

function QuickReplyRow({
  reply,
  scopeNote,
  onEdit,
  editing,
  onDelete,
  deleting,
}: {
  reply: QuickReply;
  /** Which sites offer it, or null for a business with only one. */
  scopeNote: string | null;
  onEdit: () => void;
  /** True while THIS reply is the one loaded into the form above. */
  editing: boolean;
  onDelete: () => void;
  deleting: boolean;
}) {
  return (
    <li
      // The row whose words are in the boxes above says so. Without it a person
      // who scrolled down to press a pencil, then scrolled back, has two
      // screens' worth of the same three fields and nothing joining them.
      //
      // A RING, not the module tint the panes use for "you are here". This row
      // already carries a soft module badge for its shortcut, and tinting the row
      // the same soft module color swallowed it — the one word she came to the
      // row to read. The media picker marks a chosen item the same way.
      //
      // The space lives OUTSIDE the ${} on purpose: the class sorter trims a
      // leading one inside a literal, which welds it onto the class before it.
      className={`border-base-300 flex items-start gap-3 border-b px-4 py-3 last:border-b-0 ${
        editing ? 'ring-module ring-2 ring-inset' : ''
      }`}
      aria-current={editing ? 'true' : undefined}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <Text as="span" className="font-medium">
            {reply.title}
          </Text>
          {reply.shortcut ? (
            <Badge color="module" variant="soft" size="sm">
              /{reply.shortcut}
            </Badge>
          ) : null}
          {/* The answer to the compose form's own question, on the row. The list
              serves this site's replies AND the shared ones together, so without
              it the two are indistinguishable and a reply that vanishes when she
              changes shop has no explanation on screen. */}
          {scopeNote ? (
            <Badge color={isSharedReply(reply) ? 'info' : 'module'} variant="outline" size="sm">
              {scopeNote}
            </Badge>
          ) : null}
        </div>
        <Text className="text-sm whitespace-pre-wrap">{reply.body}</Text>
      </div>
      <Button
        size="sm"
        variant="ghost"
        color="module"
        shape="square"
        aria-label={`Change “${reply.title}”`}
        title={`Change “${reply.title}”`}
        onClick={onEdit}
      >
        <Pencil className="size-4" aria-hidden />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        color="danger"
        shape="square"
        aria-label={`Delete “${reply.title}”`}
        title={`Delete “${reply.title}”`}
        loading={deleting}
        onClick={onDelete}
      >
        <Trash2 className="size-4" aria-hidden />
      </Button>
    </li>
  );
}

export function ChatQuickRepliesSurface({ ctx }: { ctx: SurfaceContext }) {
  const toast = useToast();
  const confirm = useConfirm();
  const { data, isPending, isError, isFetching, dataUpdatedAt, refetch } = useQuickReplies();
  const create = useCreateQuickReply();
  const update = useUpdateQuickReply();
  const remove = useDeleteQuickReply();
  const activeSiteId = useActivePropertyId();
  // How many websites this business runs. Every sentence about scope is silent
  // below two, and the "Where it is offered" control has no choice to offer.
  const { data: sites } = useSites();
  const siteCount = (sites ?? []).length;

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [shortcut, setShortcut] = useState('');
  const [scope, setScope] = useState<Scope>('site');
  // The reply loaded into the form, or null while it is an add form. ONE form
  // either way: this pane deliberately has no create modal (a modal is invisible
  // to the unsaved-work guard), and a second form for editing would be the same
  // mistake twice.
  const [editing, setEditing] = useState<QuickReply | null>(null);
  const formRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    ctx.setTitle('Quick replies');
  }, [ctx]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const words = editFormWords(editing);
  const busy = create.isPending || update.isPending;
  const canSubmit = title.trim() !== '' && body.trim() !== '';
  // Unsaved work is a STARTED draft while adding, and an ALTERED one while
  // editing — a person who opened a reply and changed nothing has nothing to
  // lose, so closing the pane must not stop to ask.
  const pendingChanges = editing
    ? changedReplyFields(editing, { title, body, shortcut, scope }, activeSiteId)
    : [];
  const dirty = editing
    ? pendingChanges.length > 0
    : title.trim() !== '' || body.trim() !== '' || shortcut.trim() !== '';

  useDirtySource(
    dirty && !busy,
    editing
      ? `You've changed “${editing.title}” but haven't saved it yet. Close anyway?`
      : "You've started a quick reply but haven't added it yet. Close anyway?"
  );

  const resetForm = () => {
    setTitle('');
    setBody('');
    setShortcut('');
    setScope('site');
    setEditing(null);
  };

  const startEdit = (reply: QuickReply) => {
    setEditing(reply);
    setTitle(reply.title);
    setBody(reply.body);
    setShortcut(reply.shortcut ?? '');
    setScope(scopeOf(reply));
    // The form is at the top and the row she pressed is usually below the fold.
    // Moving the page to the boxes is the whole reason the pencil reads as an
    // edit rather than as a second thing that did nothing.
    afterPaneChange(() => {
      formRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
  };

  const save = () => {
    if (!editing || !canSubmit || busy) return;
    const changed = changedReplyFields(editing, { title, body, shortcut, scope }, activeSiteId);
    // Nothing moved, so nothing is announced either. Pressing Save on a reply
    // she only read must not report work it did not do.
    if (changed.length === 0) {
      const same = savedReplyWords(editing, 0);
      resetForm();
      afterPaneChange(() => {
        toast.add(same);
      });
      return;
    }
    const saving = editing;
    update.mutate(
      {
        id: saving.id,
        ...(changed.includes('title') ? { title: title.trim() } : {}),
        ...(changed.includes('body') ? { body: body.trim() } : {}),
        // Only ever the FIRST shortcut. One already in use is shown as a fact,
        // never as a box, so it cannot be in this list.
        ...(changed.includes('shortcut') ? { shortcut: shortcut.trim() } : {}),
        // Left out entirely unless she moved it, so fixing a typo never drags a
        // reply shared across every business back to one of them.
        ...(changed.includes('scope') ? { propertyId: scope === 'all' ? null : activeSiteId } : {}),
      },
      {
        onSuccess: () => {
          afterPaneChange(() => {
            resetForm();
            toast.add(savedReplyWords(saving, changed.length));
          });
        },
        onError: (error) => {
          afterPaneChange(() => {
            toast.add({
              title: `Could not save “${saving.title}”`,
              description: chatErrorMessage(error, 'Nothing was changed. Try again.'),
              type: 'error',
            });
          });
        },
      }
    );
  };

  const add = () => {
    if (!canSubmit || busy) return;
    create.mutate(
      {
        title: title.trim(),
        body: body.trim(),
        ...(shortcut.trim() !== '' ? { shortcut: shortcut.trim() } : {}),
        // Omitted = this site (the route stamps it); explicit null = every site.
        // A ONE-SITE business is never asked, so it never chose "this site only"
        // — sending it would quietly pin every reply to the shop she happens to
        // have today, and none of them would follow her to a second one. With no
        // second business to leak into, "every site" is the honest no-choice
        // state, and it is already what the seeded replies carry.
        ...(scope === 'all' || siteCount <= 1 ? { propertyId: null } : {}),
      },
      {
        onSuccess: () => {
          // Both the reset AND the toast run one macrotask later, not in the
          // mutation's own onSuccess. onSuccess fires in the query client's
          // microtask (not a React event), so resetting the scope Select there
          // re-renders it mid-flush and its layout effect trips React's flushSync
          // guard — the same reason a post-commit toast has to be deferred. By
          // the macrotask the invalidation re-render has settled and React is
          // idle, so the Select and the toast both commit cleanly.
          afterPaneChange(() => {
            resetForm();
            toast.add({ title: 'Quick reply added', type: 'success' });
          });
        },
        onError: (error) => {
          afterPaneChange(() => {
            toast.add({
              title: 'Could not add that quick reply',
              description: chatErrorMessage(error, 'Nothing was saved. Try again.'),
              type: 'error',
            });
          });
        },
      }
    );
  };

  const onDelete = async (reply: QuickReply) => {
    // Deleting the one in the boxes would leave the form editing a row that no
    // longer exists, and Save would then fail with a not-found she cannot act on.
    if (editing?.id === reply.id) resetForm();
    const ok = await confirm({
      title: `Delete “${reply.title}”?`,
      description: deleteReplyWarning(reply, siteCount),
      confirmLabel: 'Delete it',
      cancelLabel: 'Keep it',
      color: 'danger',
    });
    if (!ok) return;
    setDeletingId(reply.id);
    remove.mutate(reply.id, {
      onSuccess: () => {
        setDeletingId(null);
        afterPaneChange(() => {
          toast.add({ title: `“${reply.title}” deleted`, type: 'success' });
        });
      },
      onError: (error) => {
        setDeletingId(null);
        afterPaneChange(() => {
          toast.add({
            title: 'Could not delete that quick reply',
            description: chatErrorMessage(error, 'Nothing was changed.'),
            type: 'error',
          });
        });
      },
    });
  };

  const replies = data ?? [];

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar
        label="Quick replies actions"
        status={
          <Text as="span" className="text-sm font-medium">
            Quick replies
          </Text>
        }
        refresh={
          <RefreshButton
            className="ml-auto"
            isFetching={isFetching}
            updatedAt={data ? dataUpdatedAt : undefined}
            onRefresh={() => {
              void refetch();
            }}
          />
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={COLUMN}>
          <div className="flex flex-col gap-1">
            <Heading level={1} className="text-2xl font-semibold">
              Quick replies
            </Heading>
            <Text>
              Save the answers you send again and again, then drop one into a conversation with a
              single click.
            </Text>
          </div>

          <div ref={formRef} className="flex flex-col gap-4">
            <FormSection title={words.heading}>
              {words.note ? <Text className="text-sm">{words.note}</Text> : null}
              <Field>
                <FieldLabel>Name</FieldLabel>
                <FieldControl
                  render={
                    <Input
                      color="module"
                      value={title}
                      maxLength={100}
                      placeholder="e.g. Shipping times"
                      onChange={(event) => {
                        setTitle(event.target.value);
                      }}
                    />
                  }
                />
                <FieldDescription>
                  What you will recognize it by in the list: the visitor never sees this.
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel>Message</FieldLabel>
                <FieldControl
                  render={
                    <Textarea
                      value={body}
                      rows={3}
                      maxLength={8000}
                      placeholder="The reply your team sends…"
                      onChange={(event) => {
                        setBody(event.target.value);
                      }}
                    />
                  }
                />
                <FieldDescription>This is the text that gets sent to the visitor.</FieldDescription>
              </Field>

              <div className="grid gap-4 @md:grid-cols-2">
                {editing && shortcutIsFixed(editing) ? (
                  /* On a reply already in use this is NOT A FIELD, so it is not
                   drawn as one. A disabled box still looks like somewhere to
                   type, and greys out the one word she opened the form to check;
                   the same badge her row wears says "this is what it is" instead
                   of "this is broken". */
                  <div className="flex flex-col gap-1">
                    <Text as="span" className="font-medium">
                      What your team types to send it
                    </Text>
                    <div>
                      <Badge color="module" variant="soft" size="sm">
                        /{editing.shortcut}
                      </Badge>
                    </div>
                    <Text className="text-sm">{fixedShortcutNote(editing)}</Text>
                  </div>
                ) : (
                  <Field>
                    <FieldLabel>Shortcut (optional)</FieldLabel>
                    <FieldControl
                      render={
                        <Input
                          color="module"
                          value={shortcut}
                          maxLength={50}
                          placeholder="shipping"
                          autoComplete="off"
                          spellCheck={false}
                          onChange={(event) => {
                            setShortcut(event.target.value);
                          }}
                        />
                      }
                    />
                    <FieldDescription>A short word to find it faster.</FieldDescription>
                  </Field>
                )}

                {/* One site, no choice to make. The house rule the shared
                  SiteScopeField states: "renders NOTHING for a tenant with one
                  site — an always-on toggle reading 'every site' is noise on the
                  99% case." This pane had not applied it. */}
                {siteCount > 1 ? (
                  <Field>
                    <FieldLabel>Where it is offered</FieldLabel>
                    <Select
                      color="module"
                      aria-label="Which sites this reply is offered on"
                      value={scope}
                      items={{ site: 'This site only', all: 'All my sites' }}
                      onValueChange={(next) => {
                        setScope(next as Scope);
                      }}
                    />
                    <FieldDescription>
                      Keep business-specific wording to this site; use “All my sites” for generic
                      replies.
                    </FieldDescription>
                  </Field>
                ) : null}
              </div>

              <div className="flex justify-end gap-2">
                {editing ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => {
                      resetForm();
                    }}
                  >
                    Cancel
                  </Button>
                ) : null}
                <Button
                  color="module"
                  size="sm"
                  loading={busy}
                  disabled={!canSubmit}
                  onClick={editing ? save : add}
                >
                  {editing ? null : <Plus className="size-4" aria-hidden />}
                  {words.submit}
                </Button>
              </div>
            </FormSection>
          </div>

          <Card className="overflow-hidden">
            <header className="border-base-300 flex items-center gap-2 border-b px-4 py-3">
              <Heading level={2} className="text-base font-semibold">
                Your saved replies
              </Heading>
              <div className="flex-1" />
              <Text className="text-sm">
                {replies.length === 1 ? '1 reply' : `${String(replies.length)} replies`}
              </Text>
            </header>
            {isError ? (
              <div className="p-4">
                <Text className="text-sm">
                  Could not load your saved replies. This is a problem reaching the server. Try
                  refreshing.
                </Text>
              </div>
            ) : isPending ? (
              <p className="p-4 text-sm" role="status">
                Loading…
              </p>
            ) : replies.length === 0 ? (
              <EmptyState
                icon={<MessageSquareText className="size-6" aria-hidden />}
                title="No quick replies yet"
                description="Add your first one above: the answers you send most often are the ones worth saving."
              />
            ) : (
              <ul>
                {replies.map((reply) => (
                  <QuickReplyRow
                    key={reply.id}
                    reply={reply}
                    scopeNote={replyScopeNote(reply, siteCount)}
                    editing={editing?.id === reply.id}
                    onEdit={() => {
                      startEdit(reply);
                    }}
                    deleting={deletingId === reply.id}
                    onDelete={() => {
                      void onDelete(reply);
                    }}
                  />
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
