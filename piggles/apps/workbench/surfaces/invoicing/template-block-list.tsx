'use client';

// What goes on the page, in what order — the body of the template editor.
//
// One row per block, top to bottom in the order they print, dragged to reorder.
// The WHOLE row header is the drag surface, no handle, the same as the workflow
// stage canvas next door: a 12px grip is a target nobody finds and the card is
// the thing that looks draggable. PointerSensor carries a 6px activation
// distance so a click on the row (or on the Remove button inside it) is still a
// click. [[feedback_drag_whole_element_not_handle]]
//
// A block's own fields open UNDERNEATH the header rather than inside it, and
// that is load-bearing rather than tidy: the header carries the drag listeners,
// and a textarea inside them cannot be selected with the pointer. Blocks drawn
// entirely from the invoice have no fields and no way to open — there is nothing
// to type.

import { useId, useState } from 'react';
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type Modifier,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Badge,
  Button,
  Field,
  FieldDescription,
  FieldLabel,
  Input,
  Select,
  Text,
  Textarea,
  Tooltip,
} from '@wizeworks/silicaui-react';
import {
  faChevronDown,
  faChevronRight,
  faPlus,
  faTrashCan,
} from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import {
  addableKinds,
  blankBlock,
  describeBlock,
  proseToText,
  textToProse,
  type TemplateBlock,
} from './template-blocks';

export interface BlockListProps {
  blocks: TemplateBlock[];
  onChange: (next: TemplateBlock[]) => void;
}

/** Keeps a dragged row in its column. `@dnd-kit/modifiers` is not a dependency
 *  of this app and this is the whole of what it would be used for — the same
 *  three lines the workflow stage canvas carries. */
const restrictToVerticalAxis: Modifier = ({ transform }) => ({ ...transform, x: 0 });

/** Does this block have anything to type into? Everything else is drawn from the
 *  invoice itself and has no settings at all. */
function hasFields(type: string): boolean {
  return type === 'Prose' || type === 'Heading' || type === 'Text' || type === 'Image';
}

function str(props: Record<string, unknown>, key: string): string {
  const value = props[key];
  return typeof value === 'string' ? value : '';
}

function BlockFields({
  block,
  onPatch,
}: {
  block: TemplateBlock;
  onPatch: (props: Record<string, unknown>) => void;
}) {
  if (block.type === 'Prose') {
    return (
      <Field>
        <FieldLabel>What it says</FieldLabel>
        <Textarea
          color="module"
          rows={4}
          value={proseToText(block.props.doc)}
          onChange={(event) => {
            onPatch({ doc: textToProse(event.target.value) });
          }}
        />
        <FieldDescription>
          One paragraph per line. This is the same on every invoice until you change it here.
        </FieldDescription>
      </Field>
    );
  }

  if (block.type === 'Heading') {
    return (
      <div className="flex flex-col gap-3 @md:flex-row @md:items-end">
        <Field className="min-w-0 flex-1">
          <FieldLabel>The words</FieldLabel>
          <Input
            color="module"
            value={str(block.props, 'text')}
            onChange={(event) => {
              onPatch({ text: event.target.value });
            }}
          />
        </Field>
        <Field className="@md:w-44">
          <FieldLabel>How big</FieldLabel>
          <Select
            color="module"
            value={str(block.props, 'level') || 'h2'}
            onValueChange={(next) => {
              onPatch({ level: next ?? 'h2' });
            }}
            items={[
              { value: 'h1', label: 'Largest' },
              { value: 'h2', label: 'Large' },
              { value: 'h3', label: 'Medium' },
            ]}
          />
        </Field>
      </div>
    );
  }

  if (block.type === 'Text') {
    return (
      <Field>
        <FieldLabel>The words</FieldLabel>
        <Input
          color="module"
          value={str(block.props, 'text')}
          onChange={(event) => {
            onPatch({ text: event.target.value });
          }}
        />
      </Field>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Field>
        <FieldLabel>Web address of the picture</FieldLabel>
        <Input
          color="module"
          value={str(block.props, 'src')}
          placeholder="https://…"
          onChange={(event) => {
            onPatch({ src: event.target.value });
          }}
        />
        <FieldDescription>
          It has to be a picture already on the web. A blank address prints nothing.
        </FieldDescription>
      </Field>
      <Field>
        <FieldLabel>What the picture shows</FieldLabel>
        <Input
          color="module"
          value={str(block.props, 'alt')}
          onChange={(event) => {
            onPatch({ alt: event.target.value });
          }}
        />
        <FieldDescription>
          Read out to anyone who cannot see it, and shown if the picture will not load.
        </FieldDescription>
      </Field>
    </div>
  );
}

function BlockRow({
  block,
  index,
  count,
  open,
  onToggle,
  onRemove,
  onPatch,
}: {
  block: TemplateBlock;
  index: number;
  count: number;
  open: boolean;
  onToggle: () => void;
  onRemove: () => void;
  onPatch: (props: Record<string, unknown>) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.key,
  });
  // dnd-kit's own functional transform — the one inline style the house allows,
  // because there is no static class that can express a moving offset.
  const style = { transform: CSS.Transform.toString(transform), transition };

  const kind = describeBlock(block);
  const editable = hasFields(block.type);

  return (
    <div ref={setNodeRef} style={style} className={isDragging ? 'opacity-40' : undefined}>
      <div className="bg-base-100 border-base-300 hover:border-base-content/20 rounded-lg border">
        <div
          {...attributes}
          {...listeners}
          role="button"
          tabIndex={0}
          aria-expanded={editable ? open : undefined}
          aria-label={`${String(index + 1)} of ${String(count)}: ${kind.label}`}
          className="flex w-full cursor-grab items-start gap-3 px-3 py-2.5 text-left"
          onClick={() => {
            if (editable) onToggle();
          }}
          onKeyDown={(event) => {
            if (!editable || (event.key !== 'Enter' && event.key !== ' ')) return;
            event.preventDefault();
            onToggle();
          }}
        >
          {editable ? (
            <Icon
              glyph={open ? faChevronDown : faChevronRight}
              className="mt-1 size-3.5 shrink-0"
              aria-hidden
            />
          ) : (
            // Keeps the labels in one column whether or not a row can open. A
            // ragged left edge reads as two kinds of list.
            <span className="mt-1 size-3.5 shrink-0" aria-hidden />
          )}
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{kind.label}</span>
              {kind.fromTheInvoice ? (
                <Badge color="module" variant="soft" size="sm">
                  Filled in for you
                </Badge>
              ) : null}
            </span>
            <Text as="span" className="text-sm">
              {kind.blurb}
            </Text>
          </span>
          {/* Exactly the remove control the invoice line rows use, down to the
              shape and the tooltip — the two lists sit one module apart and a
              second dialect of "take this row out" is how an app stops looking
              like one app. */}
          <Tooltip content={`Take out ${kind.label}`}>
            <Button
              size="sm"
              variant="ghost"
              color="danger"
              shape="square"
              aria-label={`Take out ${kind.label}`}
              onClick={(event) => {
                // The row around this is the drag surface and toggles open on
                // click, so the press has to stop here or removing a block also
                // opens the one that slid up into its place.
                event.stopPropagation();
                onRemove();
              }}
            >
              <Icon glyph={faTrashCan} className="size-4" aria-hidden />
            </Button>
          </Tooltip>
        </div>

        {editable && open ? (
          <div className="border-base-300 border-t px-3 py-3">
            <BlockFields block={block} onPatch={onPatch} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function TemplateBlockList({ blocks, onChange }: BlockListProps) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [adding, setAdding] = useState('');
  const dndId = useId();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space'] },
    })
  );

  const keys = blocks.map((block) => block.key);
  const canAdd = addableKinds(blocks);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = keys.indexOf(String(active.id));
    const to = keys.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    const next = [...blocks];
    const [moved] = next.splice(from, 1);
    if (moved) next.splice(to, 0, moved);
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-3">
      {blocks.length === 0 ? (
        <Text className="text-sm">
          Nothing on the page yet. Add a block below and it will print in the order you put them in.
        </Text>
      ) : (
        <>
          <Text className="text-sm">
            They print top to bottom, in this order. Drag one to move it.
          </Text>
          <DndContext
            id={dndId}
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={keys} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col gap-2">
                {blocks.map((block, index) => (
                  <BlockRow
                    key={block.key}
                    block={block}
                    index={index}
                    count={blocks.length}
                    open={openKey === block.key}
                    onToggle={() => {
                      setOpenKey((current) => (current === block.key ? null : block.key));
                    }}
                    onRemove={() => {
                      onChange(blocks.filter((other) => other.key !== block.key));
                    }}
                    onPatch={(props) => {
                      onChange(
                        blocks.map((other) =>
                          other.key === block.key
                            ? { ...other, props: { ...other.props, ...props } }
                            : other
                        )
                      );
                    }}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </>
      )}

      {canAdd.length === 0 ? (
        <Text className="text-sm">
          Everything there is to put on a bill is already on this one.
        </Text>
      ) : (
        <div className="flex flex-col gap-3 @md:flex-row @md:items-end">
          <Field className="min-w-0 flex-1">
            <FieldLabel>Add something to the page</FieldLabel>
            <Select
              color="module"
              value={adding}
              onValueChange={(next) => {
                setAdding((next as string | null) ?? '');
              }}
              items={[
                { value: '', label: 'Pick a block…' },
                ...canAdd.map((kind) => ({ value: kind.type, label: kind.label })),
              ]}
            />
            <FieldDescription>
              {canAdd.find((kind) => kind.type === adding)?.blurb ??
                'It goes on the end, and you can drag it where you want it.'}
            </FieldDescription>
          </Field>
          <Button
            color="module"
            disabled={adding === ''}
            onClick={() => {
              const kind = canAdd.find((entry) => entry.type === adding);
              if (!kind) return;
              const block = blankBlock(kind.type);
              onChange([...blocks, block]);
              // Open it straight away when there is something to type: a block
              // added closed leaves its starter words on the page with nothing
              // pointing at where to change them.
              setOpenKey(hasFields(block.type) ? block.key : null);
              setAdding('');
            }}
          >
            <Icon glyph={faPlus} className="size-4" aria-hidden />
            Add it
          </Button>
        </div>
      )}
    </div>
  );
}
