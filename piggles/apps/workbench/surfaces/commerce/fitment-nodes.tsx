'use client';

// The tree of values inside one fitment domain — add, rename, reorder, delete.
//
// A real dictionary is deep and wide (Make → Model → Engine, tens of thousands
// of nodes), so this is NOT a tree widget that loads everything. It is a flat
// DRILL: one level at a time, a breadcrumb of where you are, `GET …/nodes?
// parentId=` per level. That is the same shape the product picker uses, for the
// same reason — and it is the shape that fits a narrow docked pane, where a
// nested tree would be unreadable.
//
// Every act here commits immediately, with no draft over the tree, because each
// is discrete and complete on its own: adding one value is one addition,
// renaming one is one rename. A draft layer would only invent a Save to put a
// destructive act (deleting a value and everything under it) inside an ambient
// "save my changes" where nothing names what is lost. So deletion is its own
// action behind its own confirm.

import { useState } from 'react';
import { PaneWaiting } from '../../components/pane-waiting';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Heading,
  Input,
  Text,
  useToast,
} from '@wizeworks/silicaui-react';
import { useConfirm } from '../../lib/confirm';
import {
  faArrowDown,
  faArrowUp,
  faCheck,
  faChevronRight,
  faPencil,
  faPlus,
  faTrashCan,
  faXmark,
} from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import {
  dimensionSummary,
  fitmentErrorMessage,
  levelDimensions,
  pluralize,
  slugifyNode,
  useCreateFitmentNode,
  useDeleteFitmentNode,
  useFitmentNodes,
  useReorderFitmentNodes,
  useUpdateFitmentNode,
  type FitmentDomain,
  type FitmentNode,
} from './fitment-data';

interface Step {
  id: string;
  name: string;
}

export function FitmentNodeManager({ domain }: { domain: FitmentDomain }) {
  const toast = useToast();
  const confirm = useConfirm();

  const levels = levelDimensions(domain);
  const [path, setPath] = useState<Step[]>([]);
  const [addValue, setAddValue] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const depth = path.length;
  const parentId = path.length > 0 ? (path[path.length - 1]?.id ?? null) : null;
  const currentLevel = levels[depth];
  const nextLevel = levels[depth + 1];

  const nodes = useFitmentNodes(domain.id, parentId);
  const children = nodes.data ?? [];

  const create = useCreateFitmentNode(domain.id);
  const rename = useUpdateFitmentNode(domain.id);
  const remove = useDeleteFitmentNode(domain.id);
  const reorder = useReorderFitmentNodes(domain.id);

  const drillTo = (index: number) => {
    setPath((current) => current.slice(0, index));
    setEditingId(null);
    setAddValue('');
  };

  const drillInto = (node: FitmentNode) => {
    setPath((current) => [...current, { id: node.id, name: node.name }]);
    setEditingId(null);
    setAddValue('');
  };

  const onAdd = () => {
    const name = addValue.trim();
    if (name === '' || !currentLevel) return;
    create.mutate(
      {
        parentId,
        dimensionKey: currentLevel.key,
        name,
        slug: slugifyNode(name),
        position: children.length,
      },
      {
        // No toast, no close — adding many entries in a row is the common act, so
        // the box clears and keeps focus for the next one. Only a failure needs
        // announcing, because a failure is the only outcome that is not obvious
        // from the row that just appeared.
        onSuccess: () => {
          setAddValue('');
        },
        onError: (error) => {
          toast.add({
            title: 'Could not add that',
            description: fitmentErrorMessage(error, 'Nothing was changed.'),
            type: 'error',
          });
        },
      }
    );
  };

  const startRename = (node: FitmentNode) => {
    setEditingId(node.id);
    setEditValue(node.name);
  };

  const saveRename = (node: FitmentNode) => {
    const name = editValue.trim();
    if (name === '' || name === node.name) {
      setEditingId(null);
      return;
    }
    rename.mutate(
      { id: node.id, name },
      {
        onSuccess: () => {
          setEditingId(null);
        },
        onError: (error) => {
          toast.add({
            title: 'Could not rename that',
            description: fitmentErrorMessage(error, 'Nothing was changed.'),
            type: 'error',
          });
        },
      }
    );
  };

  const move = (index: number, direction: -1 | 1) => {
    const to = index + direction;
    if (to < 0 || to >= children.length) return;
    const ids = children.map((child) => child.id);
    const moved = ids[index];
    const displaced = ids[to];
    if (moved === undefined || displaced === undefined) return;
    ids[index] = displaced;
    ids[to] = moved;
    reorder.mutate(
      { parentId, orderedIds: ids },
      {
        onError: (error) => {
          toast.add({
            title: 'Could not reorder',
            description: fitmentErrorMessage(error, 'The order was not changed.'),
            type: 'error',
          });
        },
      }
    );
  };

  const onDelete = async (node: FitmentNode) => {
    const under =
      node.childCount > 0 && nextLevel
        ? ` and its ${String(node.childCount)} ${pluralize(nextLevel.label.toLowerCase(), node.childCount)}`
        : '';
    const ok = await confirm({
      title: `Delete ${node.name}?`,
      description: `This removes ${node.name}${under} from ${domain.displayName}. Any product marked as fitting ${node.name}${node.childCount > 0 ? ' or anything under it' : ''} loses that mark — the products themselves are kept. This cannot be undone.`,
      confirmLabel: `Delete ${node.name}`,
      cancelLabel: 'Keep it',
      color: 'danger',
    });
    if (!ok) return;
    remove.mutate(node.id, {
      onSuccess: () => {
        toast.add({ title: `${node.name} deleted`, type: 'success' });
      },
      onError: (error) => {
        toast.add({
          title: 'Could not delete that',
          description: fitmentErrorMessage(error, 'Nothing was removed.'),
          type: 'error',
        });
      },
    });
  };

  const levelLabel = currentLevel?.label ?? 'Entries';
  const firstLevelLower = (levels[0]?.label ?? 'entry').toLowerCase();

  return (
    <section className="card bg-base-100 flex flex-col gap-4 p-4">
      <div className="border-base-300 flex flex-col gap-0.5 border-b pb-2">
        <Heading level={2} className="text-lg font-semibold">
          The entries in this list
        </Heading>
        <Text className="text-sm">
          {`This is what a shopper picks from — the ${firstLevelLower}s you support, each narrowing down through ${dimensionSummary(domain).toLowerCase()}.`}
        </Text>
      </div>

      {/* Where you are, and the way back up. A drill with no visible path is a
          maze — you cannot tell a dead end from the bottom. */}
      <div className="flex flex-wrap items-center gap-1">
        <Button
          size="sm"
          variant="ghost"
          color="neutral"
          disabled={path.length === 0}
          onClick={() => {
            drillTo(0);
          }}
        >
          {domain.displayName}
        </Button>
        {path.map((step, index) => (
          <span key={step.id} className="flex items-center gap-1">
            <Icon glyph={faChevronRight} className="size-3 shrink-0" aria-hidden />
            <Button
              size="sm"
              variant="ghost"
              color="neutral"
              disabled={index === path.length - 1}
              onClick={() => {
                drillTo(index + 1);
              }}
            >
              {step.name}
            </Button>
          </span>
        ))}
      </div>

      {/* Add at the current level. Enter submits, so a list of makes is typed
          straight down without reaching for the mouse. */}
      {currentLevel ? (
        <div className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <label className="mb-1 block text-sm font-medium" htmlFor="fitment-add-node">
              {`Add ${levelLabel.toLowerCase()}${path.length > 0 ? ` under ${path[path.length - 1]?.name ?? ''}` : ''}`}
            </label>
            <Input
              id="fitment-add-node"
              color="module"
              size="sm"
              value={addValue}
              placeholder={placeholderFor(currentLevel.label)}
              onChange={(event) => {
                setAddValue(event.target.value);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  onAdd();
                }
              }}
            />
          </div>
          <Button
            size="sm"
            color="module"
            loading={create.isPending}
            disabled={addValue.trim() === ''}
            onClick={onAdd}
          >
            <Icon glyph={faPlus} className="size-4" aria-hidden />
            Add
          </Button>
        </div>
      ) : null}

      {nodes.isError ? (
        <Alert color="danger" variant="soft">
          <AlertContent>
            <AlertTitle>Could not load this level</AlertTitle>
            <AlertDescription>
              This is a problem reaching the server. Nothing has been changed.
            </AlertDescription>
          </AlertContent>
          <Button
            size="sm"
            color="danger"
            variant="soft"
            onClick={() => {
              void nodes.refetch();
            }}
          >
            Try again
          </Button>
        </Alert>
      ) : nodes.isPending ? (
        <PaneWaiting />
      ) : children.length === 0 ? (
        <Text className="text-sm">
          {path.length === 0
            ? `No ${firstLevelLower}s yet. Add your first one above.`
            : `Nothing under ${path[path.length - 1]?.name ?? 'here'} yet. Add one above.`}
        </Text>
      ) : (
        <ul className="flex flex-col">
          {children.map((node, index) => {
            const drillable = Boolean(nextLevel);
            const editing = editingId === node.id;
            return (
              <li
                key={node.id}
                className="border-base-300 flex items-center gap-2 border-b py-1.5 last:border-b-0"
              >
                {editing ? (
                  <>
                    <Input
                      color="module"
                      size="sm"
                      className="min-w-0 flex-1"
                      value={editValue}
                      aria-label={`Rename ${node.name}`}
                      onChange={(event) => {
                        setEditValue(event.target.value);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          saveRename(node);
                        }
                        if (event.key === 'Escape') {
                          setEditingId(null);
                        }
                      }}
                    />
                    <Button
                      size="sm"
                      color="module"
                      shape="square"
                      loading={rename.isPending}
                      aria-label="Save name"
                      title="Save name"
                      onClick={() => {
                        saveRename(node);
                      }}
                    >
                      <Icon glyph={faCheck} className="size-4" aria-hidden />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      color="neutral"
                      shape="square"
                      aria-label="Cancel rename"
                      title="Cancel"
                      onClick={() => {
                        setEditingId(null);
                      }}
                    >
                      <Icon glyph={faXmark} className="size-4" aria-hidden />
                    </Button>
                  </>
                ) : (
                  <>
                    {drillable ? (
                      <button
                        type="button"
                        className="hover:bg-base-200 flex min-w-0 flex-1 items-center gap-2 rounded px-2 py-1 text-left"
                        onClick={() => {
                          drillInto(node);
                        }}
                      >
                        <span className="min-w-0 flex-1 truncate font-medium">{node.name}</span>
                        <Badge color="neutral" variant="outline" size="sm">
                          {node.childCount === 0
                            ? `No ${nextLevel?.label.toLowerCase() ?? ''}`.trim()
                            : `${String(node.childCount)} ${pluralize(nextLevel?.label.toLowerCase() ?? 'entry', node.childCount)}`}
                        </Badge>
                        <Icon glyph={faChevronRight} className="size-4 shrink-0" aria-hidden />
                      </button>
                    ) : (
                      <span className="min-w-0 flex-1 truncate px-2 py-1 font-medium">
                        {node.name}
                      </span>
                    )}

                    <div className="flex shrink-0 items-center">
                      <Button
                        size="sm"
                        variant="ghost"
                        color="neutral"
                        shape="square"
                        disabled={index === 0 || reorder.isPending}
                        aria-label={`Move ${node.name} up`}
                        title="Move up"
                        onClick={() => {
                          move(index, -1);
                        }}
                      >
                        <Icon glyph={faArrowUp} className="size-4" aria-hidden />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        color="neutral"
                        shape="square"
                        disabled={index === children.length - 1 || reorder.isPending}
                        aria-label={`Move ${node.name} down`}
                        title="Move down"
                        onClick={() => {
                          move(index, 1);
                        }}
                      >
                        <Icon glyph={faArrowDown} className="size-4" aria-hidden />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        color="neutral"
                        shape="square"
                        aria-label={`Rename ${node.name}`}
                        title="Rename"
                        onClick={() => {
                          startRename(node);
                        }}
                      >
                        <Icon glyph={faPencil} className="size-4" aria-hidden />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        color="danger"
                        shape="square"
                        aria-label={`Delete ${node.name}`}
                        title="Delete"
                        onClick={() => {
                          void onDelete(node);
                        }}
                      >
                        <Icon glyph={faTrashCan} className="size-4" aria-hidden />
                      </Button>
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** A concrete, on-topic example for the add box, so an empty field is not a
 *  blank stare. Falls back to the level's own name for a custom domain. */
function placeholderFor(levelLabel: string): string {
  const map: Record<string, string> = {
    Make: 'Ford',
    Model: 'F-250 Super Duty',
    Engine: '6.7L Power Stroke',
    Brand: 'Apple',
    Size: 'Large',
    Species: 'Dog',
    Breed: 'Labrador Retriever',
    Department: "Men's",
    Discipline: 'Road',
  };
  return map[levelLabel] ?? `A ${levelLabel.toLowerCase()}`;
}
