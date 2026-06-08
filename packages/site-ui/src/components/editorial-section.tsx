// EditorialSection — a headline + body + CTA block (docs/51 §7). SERVER
// component. Takes resolved fields; each renderer (live site + editor canvas)
// resolves bound-vs-inline itself, then hands them here so both render
// identically.
//
// Composition: COMPOSITE (docs/23 §17) — assembles Heading + Text + Button.

import * as React from 'react';
import { cx } from '../utils/cx';
import { Heading } from './heading';
import { Text } from './text';
import { Button } from './button';

export interface EditorialSectionProps {
  eyebrow?: string;
  headline?: string;
  body?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  className?: string;
}

export function EditorialSection({
  eyebrow,
  headline,
  body,
  ctaLabel,
  ctaUrl,
  className,
}: EditorialSectionProps): React.ReactElement {
  // An empty URL → no href (Button renders a <button>, not a broken <a href="">).
  // Written as a length check, not `ctaUrl || undefined`, so it isn't rewritten to
  // `??` (which wouldn't treat '' as empty).
  const href = ctaUrl && ctaUrl.length > 0 ? ctaUrl : undefined;
  // Children are full-width (the wrapper stretches) so the surrounding box's
  // text-align governs horizontal alignment; the CTA is wrapped in a block so
  // that text-align reaches it.
  return (
    <div className={cx('sf-editorial', className)}>
      {eyebrow ? <Text variant="eyebrow">{eyebrow}</Text> : null}
      {headline ? <Heading level="h2">{headline}</Heading> : null}
      {body ? <Text variant="body">{body}</Text> : null}
      {ctaLabel ? (
        <div className="sf-editorial__cta">
          <Button href={href} variant="solid">
            {ctaLabel}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
EditorialSection.displayName = 'EditorialSection';
