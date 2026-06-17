'use client';

// Modal / Dialog island (docs/102 Track C follow-up).
//
// The one builder atom that CAN'T be a catalog composition: a dimmed full-viewport
// backdrop needs raw `fixed inset-0`, which the compile allowlist denies by design
// (clickjacking guard — only edge-pinned `st-fixed-*` pass, none center-overlays).
// The sanctioned path is the platform-authored `@sparx/site-ui` Dialog (`st-dialog`,
// Radix): its CSS ships in the component layer, so the fixed overlay never goes
// through Tailwind. Radix owns focus-trap, scroll-lock, ESC / overlay close, and the
// portal.
//
// The recipe (color/variant on `node.class`) styles the TRIGGER button — the thing
// the author sees in the canvas before opening — so the inspector's Color/Emphasis
// controls drive it like any Button. The panel is the standard modal card; its
// CONTENT is the dropped child nodes (`children`), styled the builder's normal way.
//
//   · live  — the real Radix modal (trigger collapsed; panel portalled, opens on
//             click). Mounted in both the RSC storefront tree and the client canvas.
//   · edit  — the trigger PLUS the panel shown inline + open (`.st-dialog--static`),
//             so the author can select + edit the panel and its children in place.
//             No Radix here: a portalled panel would leave the canvas's scoped
//             tenant styles and detach the children from selection.

import * as React from 'react';
import { Dialog, type DialogPlacement } from '@sparx/site-ui';

import { BuilderIcon } from './icon';
import { recipeFromClass } from './site-atoms';

function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

/** The trigger button's class — the node's recipe (color/variant/size + residual
 *  utilities) composed onto the `st-btn` base, so it reads as a real Button. */
function triggerRecipe(leafClass: string | undefined): string {
  const r = recipeFromClass(leafClass);
  return cx(
    'st-btn',
    `st-c-${r.color ?? 'primary'}`,
    `st-v-${r.variant ?? 'solid'}`,
    `st-btn--sz-${r.size ?? 'md'}`,
    r.className
  );
}

export interface BuilderDialogProps {
  /** node.class — the recipe for the TRIGGER button (CLASS_ON_LEAF passes it here). */
  leafClass?: string;
  triggerLabel: string;
  title: string;
  description?: string;
  /** The footer dismiss button's label. */
  closeLabel: string;
  placement: DialogPlacement;
  /** The editor canvas shows the panel open + inline for editing; live portals it. */
  edit: boolean;
  /** The dropped panel-body nodes (pre-rendered by the host walker). */
  children?: React.ReactNode;
}

export function BuilderDialog({
  leafClass,
  triggerLabel,
  title,
  description,
  closeLabel,
  placement,
  edit,
  children,
}: BuilderDialogProps): React.ReactElement {
  const triggerClass = triggerRecipe(leafClass);

  // Canvas: trigger + the panel shown open in-flow, so it (and its children) stay
  // selectable. Mirrors the menu/drawer behaviors, which reveal their panels in the
  // canvas for editing.
  if (edit) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          alignItems: 'flex-start',
        }}
      >
        <button type="button" className={triggerClass}>
          {triggerLabel}
        </button>
        <div className="st-dialog st-dialog--static" role="group" aria-label={title || 'Dialog'}>
          <button type="button" className="st-dialog__close" aria-label="Close" tabIndex={-1}>
            <BuilderIcon name="x" />
          </button>
          {title ? <p className="st-dialog__title">{title}</p> : null}
          {description ? <p className="st-dialog__desc">{description}</p> : null}
          {children}
          <div className="st-dialog__footer">
            <button type="button" className="st-btn st-c-primary st-v-solid st-btn--sz-md">
              {closeLabel}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Live: the real Radix modal. `aria-describedby` is suppressed when there's no
  // Description, so Radix doesn't warn about a dangling reference.
  const describe = description ? {} : { 'aria-describedby': undefined };
  return (
    <Dialog>
      <Dialog.Trigger asChild>
        <button type="button" className={triggerClass}>
          {triggerLabel}
        </button>
      </Dialog.Trigger>
      <Dialog.Content placement={placement} {...describe}>
        <Dialog.Close asChild>
          <button type="button" className="st-dialog__close" aria-label="Close">
            <BuilderIcon name="x" />
          </button>
        </Dialog.Close>
        <Dialog.Title>{title}</Dialog.Title>
        {description ? <Dialog.Description>{description}</Dialog.Description> : null}
        {children}
        <div className="st-dialog__footer">
          <Dialog.Close asChild>
            <button type="button" className="st-btn st-c-primary st-v-solid st-btn--sz-md">
              {closeLabel}
            </button>
          </Dialog.Close>
        </div>
      </Dialog.Content>
    </Dialog>
  );
}
