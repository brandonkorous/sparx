'use client';

// The `?` keyboard-shortcuts overlay (docs/builder/05 §2.6) — an in-product card
// of the editor keymap, so the shortcuts are discoverable, not folklore. It reads
// the SAME `SHORTCUTS` table the keymap binds, so the two can never disagree.
// Portaled to <body> with its own backdrop + Escape-to-close, so it floats over
// the whole editor regardless of the builder shell's stacking.

import * as React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { SHORTCUTS } from './editor-keymap';

function modLabel(): string {
  if (typeof navigator === 'undefined') return 'Ctrl';
  return /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent) ? '⌘' : 'Ctrl';
}

export function ShortcutsOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  React.useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;
  const mod = modLabel();

  return createPortal(
    <div className="bx-shortcuts" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
      <button
        type="button"
        className="bx-shortcuts__backdrop"
        aria-label="Close shortcuts"
        onClick={onClose}
      />
      <div className="bx-shortcuts__card">
        <header className="bx-shortcuts__head">
          <h2>Keyboard shortcuts</h2>
          <button
            type="button"
            className="bx-shortcuts__close"
            aria-label="Close"
            onClick={onClose}
          >
            <X aria-hidden />
          </button>
        </header>
        <div className="bx-shortcuts__grid">
          {SHORTCUTS.map((group) => (
            <section key={group.title} className="bx-shortcuts__group">
              <h3>{group.title}</h3>
              <ul>
                {group.items.map((item) => (
                  <li key={item.label}>
                    <span className="bx-shortcuts__label">{item.label}</span>
                    <span className="bx-shortcuts__keys">
                      {item.combo.map((token, i) => (
                        <kbd key={i}>{token === 'mod' ? mod : token}</kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}
