'use client';

// The Fields rail tab — the docs/51 keystone surface. The field schema is OWNED
// by the content type but AUTHORED right here in the builder, next to Layers /
// Add. It shows + edits the fields of the content type the active COLLECTION
// template renders (recordType `cms.<key>`), so a page author shapes the data and
// the layout in one place.
//
// Editing a platform built-in transparently FORKS it into a tenant-owned copy
// server-side (the badge flips from "Built-in" to "Yours" on first save). Saving
// revalidates the builder route so the binding picker (a live server prop) gains
// the new fields immediately, without disturbing the client editor state.

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { Input, NativeSelect, Switch, Textarea, useConfirm } from '@sparx/ui';
import type { FieldDef } from '@sparx/cms-schemas';

import {
  countTypeEntries,
  getContentTypeSchema,
  saveContentTypeSchema,
} from '../_lib/schema-actions';
import {
  CREATABLE_KINDS,
  KIND_LABEL,
  deriveFieldKey,
  makeFieldDef,
  type CreatableType,
} from './field-kinds';

// ── One field row (display + inline edit of label / required / help text) ──────

function FieldRow({
  field,
  canRemove,
  busy,
  onSave,
  onRemove,
}: {
  field: FieldDef;
  canRemove: boolean;
  busy: boolean;
  onSave: (next: FieldDef) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const [label, setLabel] = React.useState(field.label);
  const [required, setRequired] = React.useState(Boolean(field.required));
  const [helpText, setHelpText] = React.useState(field.helpText ?? '');

  const open = () => {
    setLabel(field.label);
    setRequired(Boolean(field.required));
    setHelpText(field.helpText ?? '');
    setEditing(true);
  };

  const commit = () => {
    const trimmed = label.trim();
    if (!trimmed) return;
    const next = { ...field, label: trimmed, required } as FieldDef;
    if (helpText.trim()) next.helpText = helpText.trim();
    else delete next.helpText;
    onSave(next);
    setEditing(false);
  };

  if (editing) {
    return (
      <li className="bx-fieldrow bx-fieldrow--editing">
        <div className="bx-field">
          <span className="bx-field__label">Label</span>
          <Input
            size="sm"
            value={label}
            aria-label="Field label"
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>
        <div className="bx-row">
          <span className="bx-field__label">Required</span>
          <Switch size="sm" checked={required} onCheckedChange={setRequired} />
        </div>
        <div className="bx-field">
          <span className="bx-field__label">Help text</span>
          <Textarea
            rows={2}
            value={helpText}
            placeholder="Shown under the field in the editor."
            aria-label="Field help text"
            onChange={(e) => setHelpText(e.target.value)}
          />
        </div>
        <div className="bx-fieldrow__editactions">
          <button
            type="button"
            className="bx-fieldrow__btn"
            disabled={busy || !label.trim()}
            onClick={commit}
          >
            <Check aria-hidden /> Save
          </button>
          <button type="button" className="bx-fieldrow__btn" onClick={() => setEditing(false)}>
            <X aria-hidden /> Cancel
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="bx-fieldrow">
      <div className="bx-fieldrow__main">
        <span className="bx-fieldrow__label">
          {field.label}
          {field.required ? <span className="bx-fieldrow__req" title="Required" /> : null}
        </span>
        <span className="bx-fieldrow__meta">
          <code className="bx-fieldrow__key">{field.key}</code>
          <span className="bx-fieldrow__kind">{KIND_LABEL[field.type] ?? field.type}</span>
        </span>
      </div>
      <div className="bx-fieldrow__actions">
        <button
          type="button"
          className="bx-fieldrow__icon"
          aria-label={`Edit ${field.label}`}
          disabled={busy}
          onClick={open}
        >
          <Pencil aria-hidden />
        </button>
        <button
          type="button"
          className="bx-fieldrow__icon bx-fieldrow__icon--danger"
          aria-label={`Remove ${field.label}`}
          disabled={busy || !canRemove}
          title={canRemove ? undefined : 'A content type needs at least one field.'}
          onClick={onRemove}
        >
          <Trash2 aria-hidden />
        </button>
      </div>
    </li>
  );
}

// ── Add-field form (label + kind → append) ─────────────────────────────────────

function AddFieldForm({
  busy,
  onAdd,
}: {
  busy: boolean;
  onAdd: (label: string, kind: CreatableType) => void;
}) {
  const [label, setLabel] = React.useState('');
  const [kind, setKind] = React.useState<CreatableType>('text');

  const submit = () => {
    const trimmed = label.trim();
    if (!trimmed) return;
    onAdd(trimmed, kind);
    setLabel('');
    setKind('text');
  };

  return (
    <div className="bx-fields__add">
      <h4 className="bx-pal-label">Add a field</h4>
      <div className="bx-field">
        <span className="bx-field__label">Label</span>
        <Input
          size="sm"
          value={label}
          placeholder="e.g. Subtitle"
          aria-label="New field label"
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submit();
            }
          }}
        />
      </div>
      <div className="bx-field">
        <span className="bx-field__label">Type</span>
        <NativeSelect
          size="sm"
          value={kind}
          aria-label="New field type"
          onChange={(e) => setKind(e.target.value as CreatableType)}
        >
          {CREATABLE_KINDS.map((k) => (
            <option key={k.type} value={k.type}>
              {k.label}
            </option>
          ))}
        </NativeSelect>
      </div>
      <button
        type="button"
        className="bx-fields__addbtn"
        disabled={busy || !label.trim()}
        onClick={submit}
      >
        <Plus aria-hidden /> Add field
      </button>
    </div>
  );
}

// ── The panel ──────────────────────────────────────────────────────────────────

export function FieldsPanel({ typeKey }: { typeKey: string }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [fields, setFields] = React.useState<FieldDef[] | null>(null);
  const [typeName, setTypeName] = React.useState('');
  const [isBuiltIn, setIsBuiltIn] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  // (Re)load the raw schema whenever the active content type changes. The API
  // resolves a tenant fork over the platform built-in, so this is always the
  // schema the builder + storefront actually use.
  React.useEffect(() => {
    let alive = true;
    setFields(null);
    setError(null);
    void getContentTypeSchema(typeKey).then((res) => {
      if (!alive) return;
      if (res.ok && res.data) {
        setFields(res.data.schema_json.fields ?? []);
        setTypeName(res.data.name);
        setIsBuiltIn(res.data.is_built_in);
      } else {
        setError(res.error ?? 'Could not load fields.');
      }
    });
    return () => {
      alive = false;
    };
  }, [typeKey]);

  // Persist a new fields[] — optimistic, reverting on a server error. A
  // successful save means the type is now tenant-owned (a built-in was forked),
  // and the binding catalog must refresh so the picker sees the change.
  const persist = React.useCallback(
    async (next: FieldDef[], prev: FieldDef[]) => {
      setFields(next);
      setBusy(true);
      setError(null);
      const res = await saveContentTypeSchema(typeKey, next);
      setBusy(false);
      if (res.ok && res.data) {
        setIsBuiltIn(false);
        router.refresh();
      } else {
        setFields(prev);
        setError(res.error ?? 'Could not save your changes.');
      }
    },
    [typeKey, router]
  );

  const onAdd = (label: string, kind: CreatableType) => {
    if (!fields) return;
    const key = deriveFieldKey(label, fields);
    void persist([...fields, makeFieldDef(kind, key, label)], fields);
  };

  const onSaveField = (next: FieldDef) => {
    if (!fields) return;
    void persist(
      fields.map((f) => (f.key === next.key ? next : f)),
      fields
    );
  };

  const onRemoveField = (field: FieldDef) => {
    if (!fields || fields.length <= 1) return;
    void (async () => {
      const res = await countTypeEntries(typeKey);
      const n = res.ok && res.data ? res.data.count : 0;
      const capped = res.ok && res.data ? res.data.capped : false;
      const impact =
        n > 0
          ? ` ${capped ? '250+' : n} ${n === 1 && !capped ? 'entry uses' : 'entries use'} this type — their saved “${field.label}” values are dropped the next time each is edited.`
          : '';
      const ok = await confirm({
        title: `Remove “${field.label}”?`,
        description: `This removes the field from every template and every API / MCP consumer of ${typeName || 'this type'}.${impact} This can’t be undone.`,
        confirmLabel: 'Remove field',
        tone: 'danger',
      });
      if (!ok || !fields) return;
      void persist(
        fields.filter((f) => f.key !== field.key),
        fields
      );
    })();
  };

  return (
    <div className="bx-fields">
      <div className="bx-fields__head">
        <p className="bx-fields__lead">
          The data shape of <strong>{typeName || typeKey}</strong>
        </p>
        <span
          className="bx-fields__badge"
          title={
            isBuiltIn
              ? 'A built-in type. Editing its fields creates your own copy.'
              : 'Your content type.'
          }
        >
          {isBuiltIn ? 'Built-in' : 'Yours'}
        </span>
      </div>
      <p className="bx-grp__caption">
        Fields are shared by every template and every API / MCP consumer of this type — not just
        this page.
      </p>

      {error ? <p className="bx-fields__err">{error}</p> : null}

      {fields === null ? (
        <p className="bx-fields__loading">Loading fields…</p>
      ) : (
        <>
          <ul className="bx-fields__list">
            {fields.map((field) => (
              <FieldRow
                key={field.key}
                field={field}
                canRemove={fields.length > 1}
                busy={busy}
                onSave={onSaveField}
                onRemove={() => onRemoveField(field)}
              />
            ))}
          </ul>
          <AddFieldForm busy={busy} onAdd={onAdd} />
        </>
      )}
    </div>
  );
}
