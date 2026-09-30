import { Badge } from '@wizeworks/silicaui-react';
import type { Offer } from '@/content/compare';

// How a thing is offered, as a state on a table cell. Status color is its own
// axis, so each answer carries its meaning before the word is read. "Not
// confirmed" is deliberately colorless: it is the absence of a fact, and
// painting it red would make it read as a "no" we never measured.

const OFFER: Record<Offer, { label: string; color?: 'success' | 'warning' | 'info' | 'danger' }> = {
  'built-in': { label: 'Built in', color: 'success' },
  partly: { label: 'Partly', color: 'warning' },
  'add-on': { label: 'Sold separately', color: 'info' },
  'other-app': { label: 'Another company’s app', color: 'info' },
  no: { label: 'No', color: 'danger' },
  unconfirmed: { label: 'Not confirmed' },
};

export function OfferBadge({ offer }: { offer: Offer }) {
  const { label, color } = OFFER[offer];
  return (
    <Badge variant="soft" size="lg" {...(color ? { color } : {})}>
      {label}
    </Badge>
  );
}
