'use client';

// Navigation as a drawer, in two levels.
//
// The desktop rail and module panel are two columns you read at once. On a
// phone there is only ever one column, so the same information becomes a
// drill-down: modules, then that module's surfaces, with a way back.
//
// The second level REUSES <ModulePanel> rather than reimplementing it. That
// keeps one answer to "what is in Selling" — including its filter, its section
// headings and its quick-create — and means a surface added to the catalog
// appears on both presentations with no second edit.

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Button,
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarItem,
} from '@wizeworks/silicaui-react';
import { ModuleScope, type WorkbenchModule } from './module-scope';
import { ModulePanel } from './module-panel';
import { useVisibleNav } from '../lib/surfaces/use-visible-nav';

export function MobileNav({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const nav = useVisibleNav();
  // null = the module list; a module = that module's surfaces.
  const [module, setModule] = useState<WorkbenchModule | null>(null);

  const close = () => {
    onOpenChange(false);
    // Reset to the module list only AFTER the drawer is shut, so the panel
    // doesn't visibly snap back to level one while sliding away.
    setTimeout(() => {
      setModule(null);
    }, 200);
  };

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        if (next) onOpenChange(true);
        else close();
      }}
    >
      {/* w-[85vw] leaves a strip of the app visible, so the drawer reads as
          covering the screen rather than being a new one. */}
      <DrawerContent side="left" className="w-[85vw] max-w-sm p-0">
        {module ? (
          <>
            <DrawerHeader sticky className="gap-2">
              <Button
                color="neutral"
                variant="ghost"
                size="sm"
                className="min-h-11 gap-1"
                onClick={() => {
                  setModule(null);
                }}
              >
                <ChevronLeft className="size-4" aria-hidden />
                All modules
              </Button>
            </DrawerHeader>
            {/* Never pinned: on a phone the panel IS the drawer, and opening
                something has to dismiss it or the surface stays covered. */}
            <ModulePanel
              module={module}
              pinned={false}
              pinnable={false}
              onTogglePin={() => undefined}
              onDismiss={close}
            />
          </>
        ) : (
          <>
            <DrawerHeader sticky>
              <DrawerTitle>Everything sparx does</DrawerTitle>
            </DrawerHeader>
            <Sidebar collapsed={false} color="module" aria-label="Modules" className="h-full">
              <SidebarContent>
                <SidebarGroup>
                  {nav.map((entry) => (
                    <ModuleScope key={entry.module} module={entry.module}>
                      <SidebarItem
                        // min-h-11 (44px) is the thumb-target floor. The rail's
                        // desktop density is a mouse affordance and would be a
                        // mis-tap generator here.
                        className="min-h-11"
                        icon={<entry.icon className="text-module size-5" aria-hidden />}
                        trailing={<ChevronRight className="size-4" aria-hidden />}
                        onClick={() => {
                          setModule(entry.module);
                        }}
                      >
                        {entry.label}
                      </SidebarItem>
                    </ModuleScope>
                  ))}
                </SidebarGroup>
              </SidebarContent>
            </Sidebar>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
}
