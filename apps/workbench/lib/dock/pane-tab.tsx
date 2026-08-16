'use client';

// The pane tab.
//
// dockview owns the OUTER `.dv-tab` element because that is the drag handle for
// reorder, split, and tear-off. It does not own what goes inside it — so the
// appearance comes from silicaui's own tab class (`tabs-tab`) applied to the
// element we render, not from tab styling invented in CSS. dockview supplies
// behaviour, silica supplies looks. dock-theme.css is then left with only the
// things that genuinely must target dockview's own nodes (strip background,
// separators, drop indicators).
//
// Module color is deliberate and always visible: the icon carries the module
// hue on every tab, and the active tab adds a bar plus a soft wash of it. The
// point is scanning eight tabs and knowing instantly which one is commerce.
// Pane BODIES stay neutral, so this is wayfinding, not decoration.
//
// Right-click is COPY LINK plus tab MANAGEMENT: close this / close others /
// close to the right, and move the tab to its own group or window. Copy link
// leads because it is the only item about the pane's CONTENT rather than about
// housekeeping, and because right-clicking a tab to copy its address is a
// gesture everybody already has from their browser. The close operations route
// through controller.requestClose so a dirty pane still gets its "close anyway?"
// conversation; the batch ones stop at the first pane the operator keeps. The
// menu portals into the tab's OWN window, so a right-click on a tab torn off to
// a second monitor opens there, not back in the opener (see useOwnerWindowBody).

import { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { IDockviewPanelHeaderProps } from 'dockview';
import {
    Button,
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger,
    PortalContainerProvider,
    Status,
} from '@wizeworks/silicaui-react';
import { ModuleScope } from '../../components/module-scope';
import { getSurface } from '../surfaces/registry';
import { useWorkbench } from '../workbench/context';
import { usePaneDirty } from '../workbench/dirty';
import { useOwnerWindowBody } from './window-boundary';
import { useCopyLink, usePaneLink } from '../../components/copy-pane-link';

export function PaneTab(props: IDockviewPanelHeaderProps<{ paneId: string }>) {
    const { controller } = useWorkbench();
    const paneId = props.params.paneId;
    const descriptor = controller.getDescriptor(paneId);
    const definition = descriptor ? getSurface(descriptor.surface) : undefined;

    // Active state read from dockview rather than inferred from a CSS ancestor —
    // that keeps the styling decision in React where the module hue also lives.
    const [active, setActive] = useState(props.api.isActive);
    useEffect(() => {
        const sub = props.api.onDidActiveChange((event) => {
            setActive(event.isActive);
        });
        return () => {
            sub.dispose();
        };
    }, [props.api]);

    // Subscribed, not just read. A surface renames itself once its record loads
    // ("Invoice" ⇒ "INV-000004", "Site" ⇒ the site's name) via ctx.setTitle, and
    // reading props.api.title alone leaves the tab showing the placeholder until
    // some UNRELATED re-render happens to repaint it — activating another tab,
    // usually. Which made it look intermittent rather than broken.
    const [title, setTitle] = useState(props.api.title ?? 'Panel');
    useEffect(() => {
        setTitle(props.api.title ?? 'Panel');
        const sub = props.api.onDidTitleChange((event) => {
            setTitle(event.title || 'Panel');
        });
        return () => {
            sub.dispose();
        };
    }, [props.api]);

    // Location drives which "move" actions make sense — a tab already in its own
    // window can't be moved to one. Live state, like GroupActions: the same panel
    // survives a tear-off, so the menu must re-read from grid → popout.
    const [location, setLocation] = useState(props.api.location.type);
    useEffect(() => {
        const sub = props.api.onDidLocationChange((event) => {
            setLocation(event.location.type);
        });
        return () => {
            sub.dispose();
        };
    }, [props.api]);

    // The menu must open in whichever window this tab currently lives in — the
    // header strip moves into the popout document along with its group.
    const hostRef = useRef<HTMLDivElement | null>(null);
    const menuContainer = useOwnerWindowBody(hostRef, props.api);

    // Closes a batch in order, STOPPING the moment the operator keeps one — a
    // declined "close anyway?" on a dirty pane halts the sweep rather than closing
    // past the thing they just chose to save. Ids are snapshotted by the caller,
    // never read live off the mutating group.
    const closeInOrder = useCallback(
        async (ids: string[]) => {
            for (const id of ids) {
                const closed = await controller.requestClose(id);
                if (!closed) break;
            }
        },
        [controller]
    );

    // Read fresh each render — the menu is rebuilt on every right-click, so these
    // reflect the group as it stands when it opens.
    const panels = props.api.group.panels;
    const index = panels.findIndex((panel) => panel.id === paneId);
    const hasOthers = panels.length > 1;
    const hasRight = index >= 0 && index < panels.length - 1;
    const canSplit = hasOthers && controller.capabilities().split;
    const inPopout = location === 'popout';

    const Icon = definition?.icon;
    const dirty = usePaneDirty(paneId);

    // Shared with the toolbar control so the two can never hand out different
    // links for the same pane.
    const link = usePaneLink(paneId);
    const copyLink = useCopyLink();

    return (
        <ContextMenu>
            <ContextMenuTrigger ref={hostRef} className="flex h-full w-full min-w-0">
                <ModuleScope
                    module={definition?.module ?? 'platform'}
                    className={[
                        // A module-colored RIGHT edge only. With every tab now carrying a tint,
                        // adjacent tabs of similar hue ran together; a full outline would draw a
                        // heavy double line between neighbours, so the separator belongs to one
                        // side. `border-module` sets the color on all four — the widths decide
                        // which ones actually show.
                        'tabs-tab flex h-full w-full items-center gap-2 px-3',
                        // Arbitrary properties, and important, for a specific reason: silica's
                        // soft treatment is `.soft[class]` — an attribute-selector specificity
                        // hack (0,2,0) — and among other things it sets `border-color:
                        // transparent`. So `border-module` (a silica class, un-wrappable by
                        // Tailwind) and a plain arbitrary property both lose on the inactive
                        // branch, and the separator rendered on the ACTIVE tab only, which is
                        // the one place it was least needed. An arbitrary property IS a Tailwind
                        // utility, so `!` applies to it and clears the hack.
                        // Three sides, open at the bottom — the tab reads as a shape attached to
                        // the pane below it rather than a floating chip.
                        'border-t-2 border-r border-b-0 border-l',
                        '[border-top-color:var(--color-module)]! [border-right-color:var(--color-module)]! [border-left-color:var(--color-module)]!',
                        // The hover half is an arbitrary-property utility rather than the
                        // obvious `hover:text-module-content`, and that is not a style choice:
                        // `text-module-content` is emitted by the SILICA PLUGIN, not by
                        // Tailwind, so Tailwind cannot wrap it in a variant or an important
                        // modifier — `hover:text-module-content` and `text-module-content!`
                        // both compile to nothing at all. Silica's own `.tabs-tab:hover { color:
                        // base-content }` then wins uncontested and the label snaps to
                        // near-black over the module fill. An arbitrary property IS Tailwind's
                        // to generate, so it lands at matching specificity and holds the ink.
                        // The inactive branch needs no equivalent: silica's `soft` sets the
                        // color itself and already outranks the hover rule.
                        active
                            ? 'bg-module text-module-content hover:[color:var(--color-module-content)]'
                            : 'bg-module soft',
                    ].join(' ')}
                >
                    {/* On the active tab the fill IS the module hue, so a module-colored glyph
              would be invisible on it — the icon switches to the on-fill ink, the
              same pair the label uses. */}
                    {Icon ? (
                        <Icon
                            className={`size-3.5 shrink-0 ${active ? 'text-module-content' : 'text-module'}`}
                            aria-hidden
                        />
                    ) : (
                        <span
                            className={`rounded-selector size-1.5 shrink-0 ${active ? 'bg-module-content' : 'bg-module'}`}
                            aria-hidden
                        />
                    )}

                    {/* `title` gives the full name back when the tab is too narrow to show it,
              which in a dock is most of the time. */}
                    <span className="min-w-0 flex-1 truncate text-sm" title={title}>
                        {title}
                    </span>

                    {/* Unsaved work, on the tab that holds it — the status bar already counts
              dirty panes, but a count cannot say WHICH, and in a dock the pane at
              risk is usually the one you cannot see. Warning, not module color:
              this has to read as a state to resolve, and every tab is already
              wearing its module hue. */}
                    {dirty ? <Status color="warning" size="sm" label="Unsaved changes" /> : null}

                    {/* A real silicaui control, not a hand-styled <button>. The eslint
              exemption on lib/dock/** exists so dock-theme.css can target dockview's
              own class names — it is not a licence to rebuild controls in here.
              Visibility is opacity-driven (see dock-theme.css) rather than display,
              so it stays reachable by keyboard. */}
                    <Button
                        color="neutral"
                        variant="ghost"
                        size="xs"
                        shape="square"
                        data-tab-close
                        aria-label={`Close ${title}`}
                        className={['shrink-0 transition-opacity', active ? 'opacity-100' : 'opacity-0'].join(
                            ' '
                        )}
                        onClick={(event) => {
                            // dockview's tab handler would activate the pane on the way through.
                            event.stopPropagation();
                            // requestClose, not close: a dirty pane gets its "close anyway?"
                            // conversation (through the pane's own window's dialog) first.
                            void controller.requestClose(paneId);
                        }}
                    >
                        <X className="size-3.5" aria-hidden />
                    </Button>
                </ModuleScope>
            </ContextMenuTrigger>

            {/* Portalled into the tab's own window so a torn-off tab's menu opens where
          the operator right-clicked, not back in the opener. */}
            <PortalContainerProvider container={menuContainer}>
                <ContextMenuContent>
                    {/* First, and above the close group, because it is the only item here
              that is about the CONTENT rather than about tab housekeeping — and
              because right-clicking a tab is the gesture people already use to
              copy a link in every browser they have ever used. Absent when the
              pane has no address; see components/copy-pane-link.tsx. */}
                    {link ? (
                        <>
                            <ContextMenuItem
                                onClick={() => {
                                    void copyLink(link);
                                }}
                            >
                                Copy link
                            </ContextMenuItem>
                            <ContextMenuSeparator />
                        </>
                    ) : null}
                    <ContextMenuItem
                        onClick={() => {
                            void closeInOrder([paneId]);
                        }}
                    >
                        Close
                    </ContextMenuItem>
                    <ContextMenuItem
                        disabled={!hasOthers}
                        onClick={() => {
                            void closeInOrder(
                                props.api.group.panels.map((panel) => panel.id).filter((id) => id !== paneId)
                            );
                        }}
                    >
                        Close others
                    </ContextMenuItem>
                    <ContextMenuItem
                        disabled={!hasRight}
                        onClick={() => {
                            const ids = props.api.group.panels.map((panel) => panel.id);
                            void closeInOrder(ids.slice(ids.indexOf(paneId) + 1));
                        }}
                    >
                        Close to the right
                    </ContextMenuItem>

                    <ContextMenuSeparator />

                    <ContextMenuItem
                        disabled={!canSplit}
                        onClick={() => {
                            // The group MUST be named: moveTo({position}) alone resolves to
                            // position 'center' on the panel's own group (a no-op). Passing the
                            // source group with a directional position drops the tab beside it,
                            // which dockview realises as a fresh group — the tab splits out of
                            // the shared strip into one of its own.
                            props.api.moveTo({ group: props.api.group, position: 'right' });
                        }}
                    >
                        Move to new group
                    </ContextMenuItem>
                    {!inPopout && controller.capabilities().popout ? (
                        <ContextMenuItem
                            onClick={() => {
                                controller.popout(paneId);
                            }}
                        >
                            Move to new window
                        </ContextMenuItem>
                    ) : null}
                </ContextMenuContent>
            </PortalContainerProvider>
        </ContextMenu>
    );
}
