// Resolve a MARKET_CATEGORIES `icon` name (a Lucide icon name) to its component.
// The taxonomy stores icon names as strings (it's a pure data package with no
// React dep), so the marketplace maps them to the actual Lucide icons here.

import {
  Wrench,
  Sparkles,
  Home,
  Shirt,
  UtensilsCrossed,
  Cpu,
  LayoutGrid,
  Tag,
  type LucideIcon,
} from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  Wrench,
  Sparkles,
  Home,
  Shirt,
  UtensilsCrossed,
  Cpu,
  LayoutGrid,
};

export function CategoryIcon({ name, size = 20 }: { name: string; size?: number }) {
  const Icon = ICONS[name] ?? Tag;
  return <Icon size={size} aria-hidden />;
}
