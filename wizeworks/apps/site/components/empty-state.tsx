// Friendly empty state with an icon, title, copy, and optional CTA.

import { ButtonLink } from './button-link';

export interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: { label: string; href: string };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="text-base-content grid place-items-center gap-3 px-6 py-[clamp(3rem,8vw,6rem)] text-center">
      {icon ? (
        <span className="text-[2.5rem] opacity-50" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <h3 className="text-base-content text-2xl font-semibold">{title}</h3>
      {description ? <p className="m-0 max-w-[40ch]">{description}</p> : null}
      {action ? (
        <ButtonLink href={action.href} style={{ marginTop: '0.5rem' }} color="primary">
          {action.label}
        </ButtonLink>
      ) : null}
    </div>
  );
}
