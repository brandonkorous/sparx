'use client';

// Collapse — a single show/hide region (docs/47 §11 B3). Radix
// (@radix-ui/react-collapsible) provides the toggle behavior + `data-state`;
// styling is all `sf-*`. The daisyUI "collapse" single-section case (Accordion is
// the multi-section one). Compound parts attach to the root + export.

import * as React from 'react';
import * as CollapsiblePrimitive from '@radix-ui/react-collapsible';
import { cx } from '../utils/cx';

function CollapseRoot({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof CollapsiblePrimitive.Root>): React.ReactElement {
  return <CollapsiblePrimitive.Root className={cx('sf-collapse', className)} {...props} />;
}
CollapseRoot.displayName = 'Collapse';

function CollapseTrigger({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<
  typeof CollapsiblePrimitive.CollapsibleTrigger
>): React.ReactElement {
  return (
    <CollapsiblePrimitive.CollapsibleTrigger
      className={cx('sf-collapse__trigger', className)}
      {...props}
    >
      <span className="sf-collapse__label">{children}</span>
      <span className="sf-collapse__indicator" aria-hidden="true" />
    </CollapsiblePrimitive.CollapsibleTrigger>
  );
}
CollapseTrigger.displayName = 'CollapseTrigger';

function CollapseContent({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<
  typeof CollapsiblePrimitive.CollapsibleContent
>): React.ReactElement {
  return (
    <CollapsiblePrimitive.CollapsibleContent
      className={cx('sf-collapse__content', className)}
      {...props}
    >
      <div className="sf-collapse__content-inner">{children}</div>
    </CollapsiblePrimitive.CollapsibleContent>
  );
}
CollapseContent.displayName = 'CollapseContent';

const Collapse = Object.assign(CollapseRoot, {
  Trigger: CollapseTrigger,
  Content: CollapseContent,
});

export { Collapse, CollapseTrigger, CollapseContent };
