'use client';

// Modal / Dialog island (docs/102 Track C follow-up).
//
// The one builder atom that CAN'T be a catalog composition: a dimmed full-viewport
// backdrop needs raw `fixed inset-0`, which the compile allowlist denies by design
// (clickjacking guard — only edge-pinned `bx-fixed-*` pass, none center-overlays).
// The sanctioned path is silicaui's Dialog: its CSS ships in silica's component
// layer, so the fixed overlay never goes through Tailwind, and Base UI owns the
// focus trap, scroll lock, ESC / backdrop close, and the portal.
//
// The node's class styles the TRIGGER button — the thing the author sees in the
// canvas before opening — so the inspector's Color/Emphasis controls drive it like
// any Button. The panel is silica's standard modal surface; its CONTENT is the
// dropped child nodes, styled the builder's normal way.
//
//   · live  — the real modal (trigger inline; panel portalled, opens on click).
//             Mounted in both the RSC storefront tree and the client canvas.
//   · edit  — the trigger PLUS the panel shown inline and open, so the author can
//             select and edit the panel and its children in place. No portal here:
//             a portalled panel would leave the canvas's scoped tenant styles and
//             detach the children from selection.

import * as React from 'react';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogTitle,
    DialogTrigger,
    buttonClasses,
    cx,
} from '@wizeworks/silicaui-react';

import { BuilderIcon } from './icon';

/** The trigger button's class. The node carries the full silica recipe already; a
 *  node authored before the class-first catalog gets the default primary button so
 *  the trigger is never an unstyled bare button. */
function triggerClassFor(leafClass: string | undefined): string {
    const tokens = (leafClass ?? '').split(/\s+/).filter(Boolean);
    if (tokens.includes('btn')) return tokens.join(' ');
    return buttonClasses({ color: 'primary', className: tokens.join(' ') || undefined });
}

/** Where the panel sits. silica centres its popup; `top`/`bottom` nudge it with
 *  layout utilities rather than a second popup variant. */
export type DialogPlacement = 'top' | 'center' | 'bottom';

const PLACEMENT: Record<DialogPlacement, string | undefined> = {
    top: 'top-[8vh] translate-y-0',
    center: undefined,
    bottom: 'top-auto bottom-[8vh] translate-y-0',
};

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
    const triggerClass = triggerClassFor(leafClass);
    const closeIconClass = buttonClasses({
        variant: 'ghost',
        size: 'sm',
        shape: 'circle',
        className: 'absolute end-2 top-2',
    });

    // Canvas: trigger + the panel shown open in flow, so it (and its children) stay
    // selectable. Mirrors the menu/drawer behaviors, which reveal their panels in the
    // canvas for editing. `dialog-popup` without the portal gives the same surface
    // treatment; `static` undoes silica's fixed centring so it sits in the page.
    if (edit) {
        return (
            <div className="flex flex-col items-start gap-3">
                <button type="button" className={triggerClass}>
                    {triggerLabel}
                </button>
                <div
                    className="dialog-popup static translate-none"
                    role="group"
                    aria-label={title || 'Dialog'}
                >
                    <button type="button" className={closeIconClass} aria-label="Close" tabIndex={-1}>
                        <BuilderIcon name="x" />
                    </button>
                    {title ? <p className="dialog-title">{title}</p> : null}
                    {description ? <p className="dialog-description">{description}</p> : null}
                    {children}
                    <div className="dialog-footer">
                        <button type="button" className={buttonClasses({ color: 'primary' })}>
                            {closeLabel}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Live: the real modal. `aria-describedby` is suppressed when there is no
    // Description, so nothing points at a missing element.
    const describe = description ? {} : { 'aria-describedby': undefined };
    return (
        <Dialog>
            <DialogTrigger>
                <button type="button" className={triggerClass}>
                    {triggerLabel}
                </button>
            </DialogTrigger>
            <DialogContent className={cx(PLACEMENT[placement])} {...describe}>
                <DialogClose>
                    <button type="button" className={closeIconClass} aria-label="Close">
                        <BuilderIcon name="x" />
                    </button>
                </DialogClose>
                <DialogTitle>{title}</DialogTitle>
                {description ? <DialogDescription>{description}</DialogDescription> : null}
                {children}
                <DialogFooter>
                    <DialogClose>
                        <button type="button" className={buttonClasses({ color: 'primary' })}>
                            {closeLabel}
                        </button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
