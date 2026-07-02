'use client';

// The NavMenu quick-editor (docs/57 rebuild). A NavMenu is a CONTAINER of NavItem
// child nodes — you can author those through the layer tree + Add palette, but for
// the everyday "manage my site nav" task that's a lot of clicks. This modal is the
// fast path: add links and dropdowns, reorder, set targets (via the shared
// link-target picker), and nest one level — all in one place — then commit the
// whole child list at once through the editor's replaceNode.
//
// It edits a local DRAFT and only writes on "Done", so Cancel is a clean undo and
// the tree churns once (not per keystroke). Reading also seeds from a NOT-YET-
// migrated NavMenu's legacy `props.links[]`, so opening + saving migrates that one
// menu to container-native NavItems. The node ⇄ rows transforms live in
// nav-menu-editor-model.ts; this file is just the React surface.

import * as React from 'react';
import { ChevronDown, ChevronUp, Plus, X } from 'lucide-react';
import {
  Button,
  Input,
  Modal,
  ModalContent,
  ModalDescription,
  ModalHeader,
  ModalTitle,
  Switch,
} from '@sparx/ui';

import { type BuilderNode } from './model';
import { LinkTargetControl } from './link-target-control';
import { type EditRow, applyRows, newRow, readRows, reorder } from './nav-menu-editor-model';

// ── Inspector entry point ──────────────────────────────────────────────────────

/** The "Manage links" field shown in a NavMenu's Content card. Summarizes the
 *  current nav and opens the editor modal. */
export function NavMenuLinksField({
  node,
  onReplace,
}: {
  node: BuilderNode;
  onReplace: (next: BuilderNode) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const rows = readRows(node);
  const drops = rows.filter((r) => r.children.length > 0).length;
  const summary =
    rows.length === 0
      ? 'No links yet'
      : `${rows.length} ${rows.length === 1 ? 'link' : 'links'}${drops > 0 ? ` · ${drops} dropdown${drops === 1 ? '' : 's'}` : ''}`;

  return (
    <div className="bx-field">
      <span className="bx-field__label">Navigation links</span>
      <button type="button" className="bx-linktarget__browse" onClick={() => setOpen(true)}>
        <Plus aria-hidden /> Manage links…
      </button>
      <span className="bx-field__hint">{summary}</span>
      {open && <NavMenuModal node={node} onSave={onReplace} onClose={() => setOpen(false)} />}
    </div>
  );
}

// ── The modal ──────────────────────────────────────────────────────────────────

function NavMenuModal({
  node,
  onSave,
  onClose,
}: {
  node: BuilderNode;
  onSave: (next: BuilderNode) => void;
  onClose: () => void;
}) {
  const [rows, setRows] = React.useState<EditRow[]>(() => readRows(node));

  const patch = (i: number, p: Partial<EditRow>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...p } : r)));

  return (
    <Modal open onOpenChange={(next) => !next && onClose()}>
      <ModalContent size="lg" mobileSheet aria-describedby={undefined}>
        <ModalHeader>
          <ModalTitle>Manage navigation</ModalTitle>
          <ModalDescription>
            Add links and dropdowns, reorder them, and choose where each one goes.
          </ModalDescription>
        </ModalHeader>

        <div className="bx-navedit">
          {rows.length === 0 ? (
            <p className="bx-navedit__empty">No links yet — add your first below.</p>
          ) : (
            rows.map((row, i) => (
              <RowEditor
                key={row.id}
                row={row}
                index={i}
                count={rows.length}
                onPatch={(p) => patch(i, p)}
                onMove={(dir) => setRows((rs) => reorder(rs, i, dir))}
                onRemove={() => setRows((rs) => rs.filter((_, idx) => idx !== i))}
              />
            ))
          )}
          <div className="bx-navedit__addrow">
            <button
              type="button"
              className="bx-navlinks__add"
              onClick={() => setRows((rs) => [...rs, newRow(false)])}
            >
              <Plus aria-hidden /> Add link
            </button>
            <button
              type="button"
              className="bx-navlinks__add"
              onClick={() => setRows((rs) => [...rs, newRow(true)])}
            >
              <Plus aria-hidden /> Add dropdown
            </button>
          </div>
        </div>

        <div className="bx-navedit__foot">
          <Button variant="ghost" color="neutral" onClick={onClose}>
            Cancel
          </Button>
          <Button
            color="primary"
            variant="solid"
            onClick={() => {
              onSave(applyRows(node, rows));
              onClose();
            }}
          >
            Done
          </Button>
        </div>
      </ModalContent>
    </Modal>
  );
}

// The reorder/remove icon trio shared by top-level rows and dropdown items.
function RowActions({
  index,
  count,
  onMove,
  onRemove,
}: {
  index: number;
  count: number;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  return (
    <div className="bx-navlinks__actions">
      <button
        type="button"
        className="bx-navlinks__icon"
        aria-label="Move up"
        disabled={index === 0}
        onClick={() => onMove(-1)}
      >
        <ChevronUp aria-hidden />
      </button>
      <button
        type="button"
        className="bx-navlinks__icon"
        aria-label="Move down"
        disabled={index === count - 1}
        onClick={() => onMove(1)}
      >
        <ChevronDown aria-hidden />
      </button>
      <button type="button" className="bx-navlinks__icon" aria-label="Remove" onClick={onRemove}>
        <X aria-hidden />
      </button>
    </div>
  );
}

// A row's dropdown items (one level of nesting) — a label + target per child, with
// reorder/remove and an "add item" affordance. Present iff the row has children.
function ChildRows({ rows, onChange }: { rows: EditRow[]; onChange: (next: EditRow[]) => void }) {
  const patch = (ci: number, p: Partial<EditRow>) =>
    onChange(rows.map((c, idx) => (idx === ci ? { ...c, ...p } : c)));
  return (
    <div className="bx-navedit__children">
      {rows.map((child, ci) => (
        <div key={child.id} className="bx-navedit__child">
          <Input
            value={child.label}
            placeholder="Label"
            onChange={(e) => patch(ci, { label: e.target.value })}
          />
          <LinkTargetControl
            value={child.href}
            placeholder="/page or https://…"
            onChange={(href) => patch(ci, { href })}
          />
          <RowActions
            index={ci}
            count={rows.length}
            onMove={(dir) => onChange(reorder(rows, ci, dir))}
            onRemove={() => onChange(rows.filter((_, idx) => idx !== ci))}
          />
        </div>
      ))}
      <button
        type="button"
        className="bx-navlinks__add"
        onClick={() => onChange([...rows, newRow(false)])}
      >
        <Plus aria-hidden /> Add dropdown item
      </button>
    </div>
  );
}

// One top-level row: label + target + new-tab, reorder/remove, and (for a dropdown)
// its nested items. Any link becomes a dropdown by adding items.
function RowEditor({
  row,
  index,
  count,
  onPatch,
  onMove,
  onRemove,
}: {
  row: EditRow;
  index: number;
  count: number;
  onPatch: (p: Partial<EditRow>) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  const isDropdown = row.children.length > 0;
  return (
    <div className="bx-navlinks__row">
      <Input
        value={row.label}
        placeholder="Label"
        onChange={(e) => onPatch({ label: e.target.value })}
      />
      {isDropdown ? (
        <span className="bx-navedit__tag">Dropdown{row.href.trim() ? ' + link' : ''}</span>
      ) : null}
      <LinkTargetControl
        value={row.href}
        placeholder={isDropdown ? 'Optional link for the heading' : '/page or https://…'}
        onChange={(href) => onPatch({ href })}
      />
      <div className="bx-navlinks__foot">
        <span className="bx-navlinks__newtab">
          <Switch
            checked={row.openInNewTab}
            onCheckedChange={(v) => onPatch({ openInNewTab: v })}
            aria-label="Open in a new tab"
          />
          New tab
        </span>
        <RowActions index={index} count={count} onMove={onMove} onRemove={onRemove} />
      </div>

      {isDropdown ? (
        <ChildRows rows={row.children} onChange={(children) => onPatch({ children })} />
      ) : (
        <button
          type="button"
          className="bx-navlinks__add"
          onClick={() => onPatch({ children: [newRow(false)] })}
        >
          <Plus aria-hidden /> Turn into dropdown
        </button>
      )}
    </div>
  );
}
