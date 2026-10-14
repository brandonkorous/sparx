'use client';

// One detail row in the record-type editor: its summary, move and remove
// buttons, and the editor that opens under it.

import { Badge, Button, Card } from '@wizeworks/silicaui-react';
import { faChevronDown, faChevronUp, faTrashCan } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { FIELD_TYPE_LABELS, type PropertyField } from './object-types-data';
import { FieldRowEditor } from './object-type-field-editor';

interface FieldRowProps {
  field: PropertyField;
  index: number;
  total: number;
  duplicate: boolean;
  expanded: boolean;
  onToggle: () => void;
  onChange: (next: PropertyField) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}

export function FieldRow(props: FieldRowProps) {
  const { field, duplicate, expanded, onChange } = props;
  return (
    <Card className={`p-3 ${duplicate ? 'border-danger border-2' : 'border-base-300 border'}`}>
      <div className="flex flex-wrap items-center gap-2">
        <FieldRowSummary {...props} />
        <FieldRowButtons {...props} />
      </div>

      {expanded ? <FieldRowEditor field={field} onChange={onChange} /> : null}
    </Card>
  );
}

function FieldRowSummary({ field, expanded, onToggle }: FieldRowProps) {
  return (
    <button
      type="button"
      className="min-w-0 flex-1 text-left"
      onClick={onToggle}
      aria-expanded={expanded}
    >
      <span className="font-medium">{field.label || 'Untitled detail'}</span>
      <Badge color="module" variant="soft" size="sm" className="ml-2">
        {FIELD_TYPE_LABELS[field.type]}
      </Badge>
      {field.required ? (
        <Badge color="warning" variant="soft" size="sm" className="ml-1">
          Must be filled in
        </Badge>
      ) : null}
    </button>
  );
}

function FieldRowButtons({ field, index, total, onMove, onRemove }: FieldRowProps) {
  return (
    <>
      <Button
        size="sm"
        color="neutral"
        variant="ghost"
        aria-label="Move up"
        disabled={index === 0}
        onClick={() => {
          onMove(-1);
        }}
      >
        <Icon glyph={faChevronUp} className="size-4" aria-hidden />
      </Button>
      <Button
        size="sm"
        color="neutral"
        variant="ghost"
        aria-label="Move down"
        disabled={index === total - 1}
        onClick={() => {
          onMove(1);
        }}
      >
        <Icon glyph={faChevronDown} className="size-4" aria-hidden />
      </Button>
      <Button
        size="sm"
        color="danger"
        variant="ghost"
        aria-label={`Remove ${field.label}`}
        onClick={onRemove}
      >
        <Icon glyph={faTrashCan} className="size-4" aria-hidden />
      </Button>
    </>
  );
}
