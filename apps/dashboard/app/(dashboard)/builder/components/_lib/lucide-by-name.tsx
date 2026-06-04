'use client';

// Renders a lucide glyph by its kebab-case NAME (a tenant component stores a name
// string, not a component reference). DynamicIcon uses React.lazy, which only
// works under a client boundary — so the catalog's server pages render custom
// icons through this island, while system icons (a real component) render
// directly.

import { DynamicIcon, type IconName } from 'lucide-react/dynamic';

export function LucideByName({ name, className }: { name: string; className?: string }) {
  return <DynamicIcon name={name as IconName} className={className} aria-hidden />;
}
