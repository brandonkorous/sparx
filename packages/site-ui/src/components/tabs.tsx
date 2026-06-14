'use client';

// Tabs — Radix behavior, Surface appearance (docs/47 §11 B3). Radix
// (@radix-ui/react-tabs) owns selection + keyboard nav + `data-state="active"`;
// styling is `st-*`. `variant` is the tab-strip treatment (line · box · lift) and
// `color` themes the active indicator off the role var. Compound parts attach +
// export.

import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cx } from '../utils/cx';
import { colorClass, type ColorKey } from './_recipes/variants';

export type TabsVariant = 'line' | 'box' | 'lift';

export type TabsProps = React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root> & {
  /** Tab-strip treatment. Defaults to `line`. */
  variant?: TabsVariant;
  /** Active-indicator color slot. Defaults to `primary`. */
  color?: ColorKey | (string & {});
};

function TabsRoot({
  className,
  variant = 'line',
  color = 'primary',
  ...props
}: TabsProps): React.ReactElement {
  return (
    <TabsPrimitive.Root
      className={cx('st-tabs', `st-tabs--${variant}`, colorClass(color), className)}
      {...props}
    />
  );
}
TabsRoot.displayName = 'Tabs';

function TabsList({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>): React.ReactElement {
  return <TabsPrimitive.List className={cx('st-tabs__list', className)} {...props} />;
}
TabsList.displayName = 'TabsList';

function TabsTab({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>): React.ReactElement {
  return <TabsPrimitive.Trigger className={cx('st-tabs__tab', className)} {...props} />;
}
TabsTab.displayName = 'TabsTab';

function TabsPanel({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>): React.ReactElement {
  return <TabsPrimitive.Content className={cx('st-tabs__panel', className)} {...props} />;
}
TabsPanel.displayName = 'TabsPanel';

const Tabs = Object.assign(TabsRoot, {
  List: TabsList,
  Tab: TabsTab,
  Panel: TabsPanel,
});

export { Tabs, TabsList, TabsTab, TabsPanel };
