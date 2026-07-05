'use client';

// Per-node bespoke inspector editors (the "easily repeatable" seam).
//
// The builder inspector is a GENERIC, data-driven prop editor — `PropsFields`, keyed
// off each component's `props` array. A few components need controls no PropSpec can
// express: an email-chip recipients editor (ContactForm), a nav link-tree editor
// (NavMenu). Rather than growing a chain of `node.type === X ? … : null` branches
// inside the ~5k-line Inspector, each registers HERE. Adding a bespoke editor for a
// new node type is a one-line registry entry + its card component — no Inspector edit.
//
// Two insertion points, matching the two shapes already in use:
//   · `Card`        — a standalone card set rendered at the TOP of the inspector
//                     stack, before the generic cards. For nodes whose whole config
//                     is bespoke; their def should carry `props: []` so the generic
//                     Content card self-suppresses (ContactForm does this).
//   · `ContentExtra`— a control rendered INSIDE the generic Content card, augmenting
//                     the prop list (NavMenu's "manage links" quick-editor).

import * as React from 'react';
import { CONTACT_FORM_TYPE } from '@sparx/builder-schemas';

import type { BuilderNode } from './model';
import { ContactFormCard } from './contact-form-inspector';
import { NavMenuLinksField } from './nav-menu-editor';

export interface NodeInspectorProps {
  node: BuilderNode;
  onProp: (key: string, value: unknown) => void;
  /** Replace the whole node in the tree (for editors that restructure children,
   *  e.g. NavMenu's link tree). Absent on surfaces that don't support it. */
  onReplaceNode?: (id: string, next: BuilderNode) => void;
}

export interface NodeInspectorEntry {
  Card?: React.ComponentType<NodeInspectorProps>;
  ContentExtra?: React.ComponentType<NodeInspectorProps>;
}

export const NODE_INSPECTORS: Record<string, NodeInspectorEntry> = {
  [CONTACT_FORM_TYPE]: {
    Card: ({ node, onProp }) => <ContactFormCard node={node} onProp={onProp} />,
  },
  NavMenu: {
    ContentExtra: ({ node, onReplaceNode }) =>
      onReplaceNode ? (
        <NavMenuLinksField node={node} onReplace={(next) => onReplaceNode(node.id, next)} />
      ) : null,
  },
};

/** The bespoke inspector entry for a node type, if any. */
export function nodeInspectorFor(type: string): NodeInspectorEntry | undefined {
  return NODE_INSPECTORS[type];
}
