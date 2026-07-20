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
// Module colour is deliberate and always visible: the icon carries the module
// hue on every tab, and the active tab adds a bar plus a soft wash of it. The
// point is scanning eight tabs and knowing instantly which one is commerce.
// Pane BODIES stay neutral, so this is wayfinding, not decoration.

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { IDockviewPanelHeaderProps } from 'dockview';
import { Button, Status } from '@wizeworks/silicaui-react';
import { ModuleScope } from '../../components/module-scope';
import { getSurface } from '../surfaces/registry';
import { useWorkbench } from '../workbench/context';
import { usePaneDirty } from '../workbench/dirty';

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

  const Icon = definition?.icon;
  const dirty = usePaneDirty(paneId);

  return (
    <ModuleScope
      module={definition?.module ?? 'platform'}
      className={[
        // A module-coloured RIGHT edge only. With every tab now carrying a tint,
        // adjacent tabs of similar hue ran together; a full outline would draw a
        // heavy double line between neighbours, so the separator belongs to one
        // side. `border-module` sets the colour on all four — the widths decide
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
        // colour itself and already outranks the hover rule.
        active
          ? 'bg-module text-module-content hover:[color:var(--color-module-content)]'
          : 'bg-module soft',
      ].join(' ')}
    >
      {/* On the active tab the fill IS the module hue, so a module-coloured glyph
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
          risk is usually the one you cannot see. Warning, not module colour:
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
        className={['shrink-0 transition-opacity', active ? 'opacity-100' : 'opacity-0'].join(' ')}
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
  );
}
