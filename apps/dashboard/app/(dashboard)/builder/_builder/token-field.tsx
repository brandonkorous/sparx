'use client';

// Inline merge-tag autocomplete (docs/52 §7) — `TokenInput` / `TokenTextarea` wrap
// the plain @sparx/ui `Input` / `Textarea` and pop a `{{`-triggered menu of the
// email's merge tags as the author types. The merge-tag vocabulary + the pure caret
// helpers (`findTokenQuery`, `insertMergeTag`, `filterMergeTags`) live in
// @sparx/builder-schemas so the editor, the reference panel, and the MCP tool all
// agree on what's available.
//
// The menu is PORTALED to <body> with fixed positioning anchored to the field — the
// inspector lives inside a Radix ScrollArea (overflow-clipped), so an inline
// absolute dropdown would be cut off. It flips above the field when there isn't room
// below. These components are used ONLY on the email surface (the only surface whose
// renderer interpolates `{{token}}`); page/site text fields stay plain.

import * as React from 'react';
import { createPortal } from 'react-dom';
import { Input, Textarea } from '@sparx/ui';
import {
  filterMergeTags,
  findTokenQuery,
  insertMergeTag,
  type MergeTag,
} from '@sparx/builder-schemas';

const MAX_ITEMS = 24;
const MENU_MAX_H = 260;

interface MenuState {
  open: boolean;
  /** Index of the opening `{{` in the field value. */
  start: number;
  /** Caret position when the menu was (re)computed — the insertion end. */
  caret: number;
  items: MergeTag[];
  active: number;
}

const CLOSED: MenuState = { open: false, start: 0, caret: 0, items: [], active: 0 };

type FieldEl = HTMLInputElement | HTMLTextAreaElement;

/** Track the field's viewport rect while the menu is open, so the portaled menu
 *  stays anchored through scrolling (the inspector ScrollArea) + window resizes. */
function useAnchorRect(elRef: React.RefObject<FieldEl | null>, open: boolean): DOMRect | null {
  const [rect, setRect] = React.useState<DOMRect | null>(null);
  React.useEffect(() => {
    if (!open) {
      setRect(null);
      return;
    }
    const update = () => {
      if (elRef.current) setRect(elRef.current.getBoundingClientRect());
    };
    update();
    // capture:true catches scrolls on any ancestor (the ScrollArea viewport).
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open, elRef]);
  return rect;
}

/** Shared autocomplete brain over a controlled string field. Returns the menu
 *  state + the handlers the wrapper spreads onto the control. */
function useTokenAutocomplete(
  value: string,
  tags: MergeTag[],
  onValueChange: (next: string) => void,
  elRef: React.RefObject<FieldEl | null>
) {
  const [menu, setMenu] = React.useState<MenuState>(CLOSED);
  const pendingCaret = React.useRef<number | null>(null);

  // After a programmatic value rewrite (token insert), restore the caret.
  React.useEffect(() => {
    if (pendingCaret.current != null && elRef.current) {
      const pos = pendingCaret.current;
      pendingCaret.current = null;
      elRef.current.setSelectionRange(pos, pos);
    }
  });

  const recompute = React.useCallback(
    (nextValue: string, caret: number) => {
      const found = findTokenQuery(nextValue, caret);
      if (!found) {
        setMenu((m) => (m.open ? CLOSED : m));
        return;
      }
      const items = filterMergeTags(tags, found.query).slice(0, MAX_ITEMS);
      if (items.length === 0) {
        setMenu((m) => (m.open ? CLOSED : m));
        return;
      }
      setMenu({ open: true, start: found.start, caret, items, active: 0 });
    },
    [tags]
  );

  const choose = React.useCallback(
    (tag: MergeTag) => {
      const { value: next, caret } = insertMergeTag(value, menu.start, menu.caret, tag.path);
      onValueChange(next);
      pendingCaret.current = caret;
      setMenu(CLOSED);
    },
    [value, menu.start, menu.caret, onValueChange]
  );

  const onChange = (e: React.ChangeEvent<FieldEl>) => {
    const next = e.target.value;
    onValueChange(next);
    recompute(next, e.target.selectionStart ?? next.length);
  };

  // Caret moved without a value change (click / arrow within text) — re-evaluate so
  // editing the middle of an existing token still offers the menu.
  const onSelect = (e: React.SyntheticEvent<FieldEl>) => {
    if (pendingCaret.current != null) return; // mid-insert; the effect will settle it
    const el = e.currentTarget;
    recompute(el.value, el.selectionStart ?? el.value.length);
  };

  /** Returns true when the key was consumed by the menu (caller skips its own
   *  handler, e.g. the subject field's Enter→blur). */
  const onKeyDown = (e: React.KeyboardEvent<FieldEl>): boolean => {
    if (!menu.open) return false;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setMenu((m) => ({ ...m, active: (m.active + 1) % m.items.length }));
      return true;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setMenu((m) => ({ ...m, active: (m.active - 1 + m.items.length) % m.items.length }));
      return true;
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      const tag = menu.items[menu.active];
      if (tag) {
        e.preventDefault();
        choose(tag);
        return true;
      }
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setMenu(CLOSED);
      return true;
    }
    return false;
  };

  // Tab/click away closes (delayed so a menu mousedown — which we preventDefault to
  // keep focus — still resolves first).
  const onBlur = () => window.setTimeout(() => setMenu(CLOSED), 120);

  return { menu, onChange, onSelect, onKeyDown, onBlur, choose };
}

function TokenMenu({
  rect,
  menu,
  onChoose,
}: {
  rect: DOMRect | null;
  menu: MenuState;
  onChoose: (tag: MergeTag) => void;
}) {
  if (!menu.open || !rect || typeof document === 'undefined') return null;
  const below = rect.bottom + MENU_MAX_H + 8 < window.innerHeight || rect.top < MENU_MAX_H;
  const style: React.CSSProperties = {
    position: 'fixed',
    left: rect.left,
    width: Math.max(rect.width, 240),
    maxHeight: MENU_MAX_H,
    ...(below ? { top: rect.bottom + 4 } : { bottom: window.innerHeight - rect.top + 4 }),
  };
  return createPortal(
    <div className="bx-tokenmenu" style={style} role="listbox" aria-label="Merge tags">
      <div className="bx-tokenmenu__list">
        {menu.items.map((tag, i) => (
          <button
            key={tag.path}
            type="button"
            role="option"
            aria-selected={i === menu.active}
            className="bx-tokenmenu__item"
            data-active={i === menu.active}
            // Keep the field focused so the caret restore lands after insert.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onChoose(tag)}
          >
            <span className="bx-tokenmenu__token">{tag.token}</span>
            <span className="bx-tokenmenu__meta">
              <span className="bx-tokenmenu__label">{tag.label}</span>
              {tag.sample ? <span className="bx-tokenmenu__sample">{tag.sample}</span> : null}
            </span>
          </button>
        ))}
      </div>
      <div className="bx-tokenmenu__foot">↑↓ to move · ↵ to insert · esc to dismiss</div>
    </div>,
    document.body
  );
}

type InputPassthrough = Omit<
  React.ComponentPropsWithoutRef<typeof Input>,
  'value' | 'onChange' | 'ref'
>;

export interface TokenInputProps extends InputPassthrough {
  value: string;
  onValueChange: (next: string) => void;
  tags: MergeTag[];
}

export function TokenInput({
  value,
  onValueChange,
  tags,
  onKeyDown,
  onBlur,
  ...rest
}: TokenInputProps) {
  const ref = React.useRef<HTMLInputElement>(null);
  const ac = useTokenAutocomplete(value, tags, onValueChange, ref);
  const rect = useAnchorRect(ref, ac.menu.open);
  return (
    <span className="bx-tokenfield">
      <Input
        {...rest}
        ref={ref}
        value={value}
        onChange={ac.onChange}
        onSelect={ac.onSelect}
        onKeyDown={(e) => {
          if (!ac.onKeyDown(e)) onKeyDown?.(e);
        }}
        onBlur={(e) => {
          ac.onBlur();
          onBlur?.(e);
        }}
      />
      <TokenMenu rect={rect} menu={ac.menu} onChoose={ac.choose} />
    </span>
  );
}

type TextareaPassthrough = Omit<
  React.ComponentPropsWithoutRef<typeof Textarea>,
  'value' | 'onChange' | 'ref'
>;

export interface TokenTextareaProps extends TextareaPassthrough {
  value: string;
  onValueChange: (next: string) => void;
  tags: MergeTag[];
}

export function TokenTextarea({
  value,
  onValueChange,
  tags,
  onKeyDown,
  onBlur,
  ...rest
}: TokenTextareaProps) {
  const ref = React.useRef<HTMLTextAreaElement>(null);
  const ac = useTokenAutocomplete(value, tags, onValueChange, ref);
  const rect = useAnchorRect(ref, ac.menu.open);
  return (
    <span className="bx-tokenfield">
      <Textarea
        {...rest}
        ref={ref}
        value={value}
        onChange={ac.onChange}
        onSelect={ac.onSelect}
        onKeyDown={(e) => {
          if (!ac.onKeyDown(e)) onKeyDown?.(e);
        }}
        onBlur={(e) => {
          ac.onBlur();
          onBlur?.(e);
        }}
      />
      <TokenMenu rect={rect} menu={ac.menu} onChoose={ac.choose} />
    </span>
  );
}
