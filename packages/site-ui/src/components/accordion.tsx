'use client';

// Accordion — Radix behavior, Surface appearance (docs/47 §11 B3). Radix
// (@radix-ui/react-accordion) provides the open/close state, keyboard nav, and
// `data-state` attributes; ALL styling is our `sf-*` classes + tokens (no Radix
// class convention). `icon` switches the trigger indicator (arrow / plus), styled
// in CSS off `[data-state='open']`. Compound parts attach to the root + export.

import * as React from 'react';
import * as AccordionPrimitive from '@radix-ui/react-accordion';
import { cx } from '../utils/cx';

export type AccordionIcon = 'arrow' | 'plus' | 'none';

export type AccordionProps = React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Root> & {
  /** Trigger indicator style. Defaults to `arrow`. */
  icon?: AccordionIcon;
};

function AccordionRoot({
  className,
  icon = 'arrow',
  ...props
}: AccordionProps): React.ReactElement {
  return (
    <AccordionPrimitive.Root
      className={cx('sf-accordion', icon !== 'none' && `sf-accordion--${icon}`, className)}
      {...props}
    />
  );
}
AccordionRoot.displayName = 'Accordion';

function AccordionItem({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>): React.ReactElement {
  return <AccordionPrimitive.Item className={cx('sf-accordion__item', className)} {...props} />;
}
AccordionItem.displayName = 'AccordionItem';

function AccordionTrigger({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>): React.ReactElement {
  return (
    <AccordionPrimitive.Header className="sf-accordion__header">
      <AccordionPrimitive.Trigger className={cx('sf-accordion__trigger', className)} {...props}>
        <span className="sf-accordion__label">{children}</span>
        <span className="sf-accordion__indicator" aria-hidden="true" />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
}
AccordionTrigger.displayName = 'AccordionTrigger';

function AccordionContent({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>): React.ReactElement {
  return (
    <AccordionPrimitive.Content className={cx('sf-accordion__content', className)} {...props}>
      <div className="sf-accordion__content-inner">{children}</div>
    </AccordionPrimitive.Content>
  );
}
AccordionContent.displayName = 'AccordionContent';

const Accordion = Object.assign(AccordionRoot, {
  Item: AccordionItem,
  Trigger: AccordionTrigger,
  Content: AccordionContent,
});

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
