// Friendly empty state with an icon, title, copy, and optional CTA.

import Link from 'next/link';

import { SparxButton } from '@sparx/site-ui';

export interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: { label: string; href: string };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="st-empty">
      {icon ? (
        <span className="st-empty__icon" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <h3 className="st-h3" style={{ color: 'var(--st-text)' }}>
        {title}
      </h3>
      {description ? <p style={{ margin: 0, maxWidth: '40ch' }}>{description}</p> : null}
      {action ? (
        <SparxButton asChild color="primary">
          <Link href={action.href} style={{ marginTop: '0.5rem' }}>
            {action.label}
          </Link>
        </SparxButton>
      ) : null}
    </div>
  );
}
