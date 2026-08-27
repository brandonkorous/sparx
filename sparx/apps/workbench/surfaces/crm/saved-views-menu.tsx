'use client';

// Saved views — "the list, the way I always want it" (docs/144 §12).
//
// A CRM list is only useful once it is narrowed, and the narrowing is the part
// people repeat: open Customers, set the stage to lead, sort by newest, every
// morning. A saved view is that set of choices given a name, so the second
// morning is one click.
//
// ONE CONTROL IN THE TOOLBAR, beside Refresh — not a second bar above the list.
// A row of its own costs every visitor vertical space for something most of them
// use occasionally, and it made saved views look like a feature of the Customers
// screen rather than a thing every list has. The trigger doubles as the
// indicator: it reads the active view's name, so "which list am I looking at" is
// answered by the same control that changes it.
//
// FILTERS ARE THE PLATFORM'S CONDITION DSL — the same `ConditionGroup` segments,
// automations, reports and scoring already use. One filter language is one thing
// to learn, and a view can be handed to a report without translation. An earlier
// version stored a flat bag of one list's control names, which the schema
// silently normalised to an empty group: every view saved a filter set of
// nothing and reported success.
//
// LIST-AGNOSTIC ON PURPOSE. Every CRM list gets the same control by passing its
// object key and the two small adapters between its own controls and the DSL.
// Nothing here knows what a customer is.
//
// WHOSE VIEW IT IS MATTERS. A view is private until somebody shares it, and only
// its author can delete one. Shared views are how a team agrees what "open
// leads" means; being able to delete a colleague's is how that agreement
// disappears underneath them.

import { useState } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Field,
  FieldDescription,
  FieldLabel,
  Input,
  Switch,
  Text,
  Tooltip,
  useToast,
} from '@wizeworks/silicaui-react';
import { Bookmark, Check, ChevronDown, Trash2, Users } from 'lucide-react';
import {
  isConditionGroup,
  type ConditionGroup,
  type ConditionOperator,
} from '@wizeworks/automation-schemas';
import { useConfirm } from '../../lib/confirm';
import { PaneScope } from '../../lib/dock/window-boundary';
import { useViewer } from '../../lib/api/shell-data';
import {
  useSaveView,
  useSavedViews,
  workspaceErrorMessage,
  type SavedView,
} from './workspace-data';

/* ── The two adapters every list needs ──────────────────────────────────── */

// A list has dropdowns; the platform has a condition language. These translate
// between them, and they live HERE rather than in each list because the
// translation had one specific way of going wrong: an operator name not in the
// enum did not throw. `Condition` failed, the union fell through to the
// sub-group branch whose fields are all defaulted, and the leaf was stored as an
// empty group — so the view saved "no filters" and reported success.
//
// That runtime hole is now CLOSED AT THE SOURCE: condition groups are strict, so
// a leaf that fails validation fails the whole parse instead of becoming "match
// everything". This note used to describe a live trap that this file worked
// around locally, which is why it kept catching people elsewhere — a shipped
// campaign recipe fell straight into it. Typing the operator as
// `ConditionOperator` here is still worth doing: it moves the same mistake from
// a rejected write to a compile error, which is a better place to find it.

/** One control's choice, expressed as a condition on a real field. */
export interface ViewLeaf {
  /** A path the resolvers already publish (`customer.type`), never a control name. */
  field: string;
  operator: ConditionOperator;
  /** Omitted only for the presence operators (`is_set` / `is_not_set`). */
  value?: unknown;
}

/**
 * A list's controls as a filter group. Anything falsey is dropped, so a control
 * set to "everything" is written by leaving its condition out — absence is how
 * the DSL spells "no restriction", which is what makes a view saved on one
 * screen mean the same thing to a report or a segment.
 */
export function viewFilters(leaves: (ViewLeaf | false | null | undefined)[]): ConditionGroup {
  return { logic: 'AND', conditions: leaves.filter((leaf): leaf is ViewLeaf => Boolean(leaf)) };
}

/** A view's leaf conditions. Nested sub-groups are legal in the DSL but cannot
 *  be shown in a row of dropdowns, so reading a view back ignores them — the
 *  view still applies as saved wherever the DSL is evaluated in full. */
function viewLeaves(view: SavedView | null): ViewLeaf[] {
  return (view?.filters.conditions ?? []).filter(
    (node): node is ViewLeaf => !isConditionGroup(node) && typeof node === 'object'
  );
}

/** What a view says about one field, as text for a dropdown. Empty when the view
 *  does not mention the field — which the caller reads as "everything". */
export function viewFilterValue(view: SavedView | null, field: string): string {
  const value = viewLeaves(view).find((leaf) => leaf.field === field)?.value;
  if (typeof value === 'string') return value;
  // A number or a boolean still answers a dropdown (`deal.isClosed` is `false`,
  // shown as "Open"). Anything richer — a list, a date range — is a condition no
  // row of dropdowns can represent, so it reads as absent here and is left to
  // apply as saved wherever the DSL is evaluated in full.
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

/** Whether a view carries a condition on this field at all. The read-back for a
 *  presence check (`is_not_set`) and for a flag, neither of which has text. */
export function viewFilterHas(view: SavedView | null, field: string): boolean {
  return viewLeaves(view).some((leaf) => leaf.field === field);
}

/* ── The control ────────────────────────────────────────────────────────── */

export interface SavedViewsMenuProps {
  /** Which list this belongs to — `contact`, `company`, `deal`, or a tenant's own. */
  objectKey: string;
  /** The filters as they stand right now, in the platform's condition DSL. */
  current: ConditionGroup;
  /**
   * The list with nothing chosen — what "Everything" means.
   *
   * Needed because "nothing applied" is not the same as "no conditions": a list
   * may narrow by default. Without it the menu offered to save an untouched
   * list, which is the offer that teaches people to stop reading it.
   */
  baseline: ConditionGroup;
  /**
   * How the list is ordered now. Its own column on a saved view rather than a
   * condition — a sort chooses the ORDER of rows a filter has already chosen.
   *
   * Omitted by the lists that have no sort control, which is not the same as
   * sorting by nothing: the server's own order (a support queue runs by what is
   * late soonest) is the right answer, and storing a guess here would override
   * it every time somebody opened the view.
   */
  sort?: { field: string; direction: 'asc' | 'desc' };
  /**
   * An example name, in this list's own vocabulary. Every list passes its own:
   * a placeholder suggesting "New enquiries" on the Companies screen is the
   * small tell that a control was built for somewhere else and reused here.
   */
  nameHint?: string;
  /** Which view is showing, or null for the whole list. */
  selectedId: string | null;
  /** Apply a view — `null` means "back to everything". */
  onApply: (view: SavedView | null) => void;
}

/**
 * A value written so that two structures meaning the same thing produce the same
 * string — object keys sorted, not merely serialised.
 *
 * `JSON.stringify` alone is not enough, and the reason is worth knowing: filters
 * are stored in a `jsonb` column, and Postgres does not keep the key order it
 * was given — it re-orders by key length, then bytes. A condition saved as
 * `{field, operator, value}` comes back as `{field, value, operator}`. Comparing
 * the raw strings therefore said "these differ" about a view that had JUST been
 * saved from exactly these controls, so the menu never once reached "Nothing new
 * to save" and quietly invited a second copy of every view.
 */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

/** Whether two filter sets say the same thing. Order-insensitive in both
 *  directions — two lists that narrow to the same rows are the same view however
 *  they were typed, and whatever order the database hands them back in. */
function sameFilters(a: ConditionGroup, b: ConditionGroup): boolean {
  const key = (group: ConditionGroup): string =>
    canonical({ logic: group.logic, conditions: [...group.conditions].map(canonical).sort() });
  return key(a) === key(b);
}

export function SavedViewsMenu({
  objectKey,
  current,
  baseline,
  sort,
  nameHint = 'The ones I check daily',
  selectedId,
  onApply,
}: SavedViewsMenuProps) {
  const { data } = useSavedViews(objectKey);
  const { create, remove } = useSaveView(objectKey);
  const { data: viewer } = useViewer();
  const toast = useToast();
  const confirm = useConfirm();

  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const [shared, setShared] = useState(false);

  const views = data?.items ?? [];
  const selected = views.find((view) => view.id === selectedId) ?? null;

  // Offer to save only when the choices differ from what is showing — against
  // the selected view, or against the untouched list. A save action that is
  // always available is one nobody reads.
  const changed = selected
    ? !sameFilters(current, selected.filters)
    : !sameFilters(current, baseline);

  const closeNaming = (): void => {
    setNaming(false);
    setName('');
    setShared(false);
  };

  const save = (): void => {
    create.mutate(
      { objectKey, name: name.trim(), filters: current, sort: sort ?? null, isShared: shared },
      {
        onSuccess: (view) => {
          closeNaming();
          onApply(view);
          toast.add({ title: `“${view.name}” saved`, type: 'success' });
        },
        onError: (error) => {
          toast.add({
            title: 'Could not save that view',
            description: workspaceErrorMessage(error, 'Nothing was changed.'),
            type: 'error',
          });
        },
      }
    );
  };

  const drop = async (view: SavedView): Promise<void> => {
    const ok = await confirm({
      title: `Delete “${view.name}”?`,
      description: view.isShared
        ? 'It disappears for everyone on your team. The records in it are untouched — this only removes the saved set of filters.'
        : 'The records in it are untouched — this only removes the saved set of filters.',
      confirmLabel: 'Delete it',
      cancelLabel: 'Keep it',
      color: 'danger',
    });
    if (!ok) return;
    remove.mutate(view.id, {
      onSuccess: () => {
        if (selectedId === view.id) onApply(null);
        toast.add({ title: `“${view.name}” deleted`, type: 'success' });
      },
    });
  };

  return (
    <>
      <DropdownMenu>
        <Tooltip content="Saved views — the list the way you always want it">
          <DropdownMenuTrigger>
            {/* Soft-filled while a view is on, so the toolbar shows at a glance
                that the rows below are a subset. Neutral ghost on the whole
                list, where there is nothing to announce. */}
            <Button
              color={selected ? 'module' : 'neutral'}
              variant={selected ? 'soft' : 'ghost'}
              size="sm"
              className="gap-1.5"
            >
              <Bookmark className="size-4" aria-hidden />
              {selected ? selected.name : 'Views'}
              <ChevronDown className="size-3" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
        </Tooltip>

        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Show</DropdownMenuLabel>

            <DropdownMenuItem
              onClick={() => {
                onApply(null);
              }}
            >
              <span className="flex w-full items-center gap-2">
                <span className="flex-1">Everything</span>
                {selected === null ? <Check className="size-4 shrink-0" aria-hidden /> : null}
              </span>
            </DropdownMenuItem>

            {views.map((view) => (
              <DropdownMenuItem
                key={view.id}
                onClick={() => {
                  onApply(view);
                }}
              >
                <span className="flex w-full items-center gap-2">
                  <span className="min-w-0 flex-1 truncate">{view.name}</span>
                  {view.isShared ? (
                    <Users className="size-3.5 shrink-0" aria-label="Shared with your team" />
                  ) : null}
                  {selectedId === view.id ? (
                    <Check className="size-4 shrink-0" aria-hidden />
                  ) : null}
                </span>
              </DropdownMenuItem>
            ))}

            {views.length === 0 ? (
              <DropdownMenuItem disabled>
                <span className="text-sm">No saved views yet — narrow the list, then save it.</span>
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuGroup>

          <DropdownMenuSeparator />

          <DropdownMenuGroup>
            <DropdownMenuItem
              disabled={!changed}
              onClick={() => {
                setNaming(true);
              }}
            >
              <span className="flex w-full items-center gap-2">
                <Bookmark className="size-4 shrink-0" aria-hidden />
                <span className="flex-1">
                  {changed ? 'Save these filters as a view' : 'Nothing new to save'}
                </span>
              </span>
            </DropdownMenuItem>

            {/* Delete lives beside the view it deletes, and only for its author. */}
            {selected !== null && selected.userId === viewer?.userId ? (
              <DropdownMenuItem
                onClick={() => {
                  void drop(selected);
                }}
              >
                <span className="flex w-full items-center gap-2">
                  <Trash2 className="size-4 shrink-0" aria-hidden />
                  <span className="flex-1">Delete “{selected.name}”</span>
                </span>
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <PaneScope>
        <Dialog
          open={naming}
          onOpenChange={(next) => {
            if (!next) closeNaming();
          }}
        >
          <DialogContent className="flex max-h-[calc(100%-2rem)] max-w-md flex-col overflow-hidden">
            <DialogTitle>Save this view</DialogTitle>

            <form
              id="save-crm-view"
              className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1 py-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (name.trim() !== '') save();
              }}
            >
              <Field>
                <FieldLabel>What to call it</FieldLabel>
                <Input
                  color="module"
                  value={name}
                  placeholder={nameHint}
                  onChange={(event) => {
                    setName(event.target.value);
                  }}
                />
                <FieldDescription>
                  Name it after what you use it for, not what it filters on — that is what you will
                  be scanning for next week.
                </FieldDescription>
              </Field>

              <Field>
                <div className="flex items-start gap-3">
                  <Switch
                    color="module"
                    aria-label="Share it with your team"
                    checked={shared}
                    onCheckedChange={(checked) => {
                      setShared(checked === true);
                    }}
                  />
                  <div className="flex flex-col gap-1">
                    <FieldLabel>Share it with your team</FieldLabel>
                    <FieldDescription>
                      Everyone sees it and can use it; only you can delete it.
                    </FieldDescription>
                  </div>
                </div>
              </Field>

              <Text className="text-sm">
                Saving keeps the filters and the order as they are set right now.
                {selected ? ` “${selected.name}” is left as it was.` : ''}
              </Text>
            </form>

            <DialogFooter>
              <Button color="neutral" variant="ghost" size="sm" onClick={closeNaming}>
                Cancel
              </Button>
              <Button
                type="submit"
                form="save-crm-view"
                color="module"
                size="sm"
                loading={create.isPending}
                disabled={name.trim() === ''}
              >
                Save the view
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PaneScope>
    </>
  );
}
