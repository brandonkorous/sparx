'use client';

// "There is nothing to show here" — for a surface that is not a list.
//
// The third member of the family, beside <ListEmptyState> (a list with no rows)
// and <PaneLoadError> (a surface that could not load). This one covers the case
// neither of those does: a pane that is working perfectly and has nothing to
// display yet, because nothing has been chosen or nothing applies.
//
//   "No batch was chosen"      — a detail pane opened without a record
//   "Nothing to reconcile"     — a task pane with no work waiting
//   "This product has no variants"
//
// Those were being written as a bare silica <EmptyState> centred in a bare div,
// which is the same bug the other two had: no card, so the message floated in an
// empty pane instead of sitting where the content goes.
//
// ── WHY IT IS NOT JUST <ListEmptyState> ─────────────────────────────────────
//
// That component's whole job is deciding between "your filter matched nothing"
// and "you have not made one yet" from a `filtered` boolean. A pane with no
// record chosen has no filter and no first run — passing it a made-up boolean to
// reach the same visual would be lying to the component that owns that decision.
// Different question, different component, same family.
//
// ── THE TONE ────────────────────────────────────────────────────────────────
//
// Module, not neutral. This state is an INVITATION — open a record, pick a
// batch, add the first variant — and it is the app's own hue that says which app
// is inviting you. silica's EmptyState paints a 55%-faded base-content glyph and
// takes no color, so the tone is applied here, once, for the same reason it is
// applied inside the other two: the caller passes its glyph, the component
// decides what the state looks like.

import type { ReactNode } from 'react';
import { EmptyState } from '@wizeworks/silicaui-react';
import { hasStateArt, StateArt } from './state-art';

export function PaneEmpty({
    icon,
    module,
    title,
    description,
    actions,
}: {
    /** The surface's own glyph, so the state still looks like the pane it is. */
    icon?: ReactNode;
    /** Which module's pane this is, so a brand with per-app artwork can draw the
     *  right picture. */
    module?: string;
    title: ReactNode;
    description?: ReactNode;
    /** The way out — usually the thing that would fill this pane. */
    actions?: ReactNode;
}) {
    const branded = hasStateArt();

    return (
        <div className="flex h-full min-h-72 flex-col items-center justify-center gap-1 px-6 py-10">
            <StateArt state="empty" module={module} />
            <EmptyState
                icon={branded ? undefined : icon ? <span className="text-module">{icon}</span> : undefined}
                title={title}
                description={description}
                actions={actions}
            />
        </div>
    );
}
