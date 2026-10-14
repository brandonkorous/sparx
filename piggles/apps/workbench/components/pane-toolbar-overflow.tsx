'use client';

// Where a narrow toolbar's controls go. They are RELOCATED, not rewritten: the
// same nodes the wide bar renders inline, sorted into what you are looking at
// (filters, sorts) and what you can DO (refresh, copy a link), split by a rule.

// A menu has no position to read and no hover on a touch screen, so an
// unlabeled glyph is a button with no meaning. Relocated chrome therefore
// takes `presentation="menu"` and wears its label.

import { cloneElement, isValidElement } from 'react';
import { CopyPaneLink } from './copy-pane-link';
import { ToolbarFilterSelects, type ToolbarFilter } from './pane-toolbar-filters';
import { ToolbarActionRows, type ToolbarAction } from './pane-toolbar-actions';
import { PaneToolbarOverflow } from './pane-toolbar-popover';
import { ToolbarViewsControl, type ToolbarViews } from './pane-toolbar-views';
import type { ToolbarPresentation } from './toolbar-presentation';

interface CollapsedToolbarProps {
  label: string;
  activeCount: number;
  filters?: readonly ToolbarFilter[];
  actions?: readonly ToolbarAction[];
  controls?: React.ReactNode;
  refresh?: React.ReactNode;
  views?: ToolbarViews;
  /** Whether CopyPaneLink will render. Decided by the bar so the actions zone is
   *  never an empty strip of padding. */
  hasLink?: boolean;
}

/** Give a relocatable control its menu shape. Anything else passes through. */
function asMenuRow(node: React.ReactNode): React.ReactNode {
  return isValidElement<{ presentation?: ToolbarPresentation }>(node)
    ? cloneElement(node, { presentation: 'menu' })
    : node;
}

/** What a narrow toolbar folds away, sorted into the two zones. The single answer
 *  to "what does the popover contain", so PaneToolbar states each slot once. */
export function CollapsedToolbar({
  label,
  activeCount,
  filters,
  actions,
  controls,
  refresh,
  views,
  hasLink = true,
}: CollapsedToolbarProps) {
  const hasFilters = Boolean(filters && filters.length > 0);
  const hasActions = Boolean(actions && actions.length > 0);
  const hasRows = hasActions || Boolean(views) || Boolean(refresh) || hasLink;

  return (
    <PaneToolbarOverflow
      label={label}
      activeCount={activeCount}
      controls={
        hasFilters || controls ? (
          <>
            {hasFilters ? <ToolbarFilterSelects filters={filters ?? []} /> : null}
            {controls}
          </>
        ) : null
      }
      // Views sits with Refresh and Copy link: those three are about the pane
      // (which question, is it current, how to send it), not about this list.
      actions={
        hasRows ? (
          <>
            {hasActions ? <ToolbarActionRows actions={actions ?? []} /> : null}
            {views ? (
              <ToolbarViewsControl views={views} filters={filters ?? []} presentation="menu" />
            ) : null}
            {asMenuRow(refresh)}
            <CopyPaneLink presentation="menu" />
          </>
        ) : null
      }
    />
  );
}
