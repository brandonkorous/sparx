import type { ReactNode } from 'react';
import type { PigglesGroup } from '@piggles/brand';

// Repoints the active hue for a subtree, in Piggles' own vocabulary.
//
// The shared workbench has `<ModuleScope module="commerce">`, which writes
// `data-module` and is what every SURFACE emits. This is its counterpart for the
// SHELL, which does not think in modules: it writes `data-app` (or `data-group`),
// and @piggles/brand's theme.css maps all three attributes onto the same
// `--color-module` bridge. So a rail item and the pane it opens end up wearing
// the same hue by two different names, which is the point — the shell speaks
// Piggles and the surfaces speak platform, and CSS reconciles them.
//
// Like its counterpart, this renders NOTHING but an attribute. No inline
// `style`, no JS color table that can drift from the tokens.
//
// One consequence worth knowing: CSS variables cascade by DOM, not by React
// tree. A pane portalled into a detached window does not inherit a scope from
// the React tree above it — which is why every pane carries its own ModuleScope
// in its own subtree, and why this is only ever used on chrome that renders in
// the main document.

export function AppScope({
  app,
  children,
  className,
}: {
  /** A Piggles app id — `sell`, `customers`, `get_found`. */
  app: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div data-app={app} className={className}>
      {children}
    </div>
  );
}

export function GroupScope({
  group,
  children,
  className,
}: {
  group: PigglesGroup;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div data-group={group} className={className}>
      {children}
    </div>
  );
}
