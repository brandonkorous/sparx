'use client';

// One icon vocabulary for the flow editor, shared by the canvas node markers and
// the inspector headers so a node always wears the same glyph in both places.
// Keyed by the pure `NodeIconKey` from `_lib/flow` (which carries no JSX).

import {
  Ban,
  Building2,
  Clock,
  Filter,
  GitBranch,
  Hourglass,
  ListChecks,
  Mail,
  MailPlus,
  PencilLine,
  Repeat,
  Settings2,
  ShoppingCart,
  StickyNote,
  Tag,
  Webhook,
  Zap,
  type LucideIcon,
} from 'lucide-react';

import type { NodeIconKey } from '../_lib/flow';

export const NODE_ICONS: Record<NodeIconKey, LucideIcon> = {
  settings: Settings2,
  zap: Zap,
  clock: Clock,
  filter: Filter,
  wait: Hourglass,
  stop: Ban,
  webhook: Webhook,
  tag: Tag,
  'tag-off': Tag,
  note: StickyNote,
  field: PencilLine,
  task: ListChecks,
  deal: GitBranch,
  mail: Mail,
  'mail-plus': MailPlus,
  sequence: Repeat,
  b2b: Building2,
  commerce: ShoppingCart,
  action: Zap,
};

export function NodeIcon({ iconKey }: { iconKey: NodeIconKey }) {
  const Icon = NODE_ICONS[iconKey];
  return <Icon aria-hidden />;
}
