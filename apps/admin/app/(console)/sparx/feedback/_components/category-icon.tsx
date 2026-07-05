import { HelpCircle, Lightbulb, Sparkles, TriangleAlert } from 'lucide-react';
import { categoryLabel } from '@/lib/feedback';

// The feedback category as a small, muted icon (the status Badge carries the
// semantic color; the category icon is wayfinding, not a second color axis).
const ICONS = {
  idea: Lightbulb,
  problem: TriangleAlert,
  question: HelpCircle,
  praise: Sparkles,
} as const;

export function CategoryIcon({ category, className }: { category: string; className?: string }) {
  const Icon = ICONS[category as keyof typeof ICONS] ?? Lightbulb;
  return (
    <Icon
      className={className ?? 'h-4 w-4 text-[var(--color-text-muted)]'}
      aria-label={categoryLabel(category)}
    />
  );
}
