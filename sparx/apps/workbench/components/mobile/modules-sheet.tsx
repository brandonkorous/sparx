'use client';

// Every module, then that module's surfaces — the phone's two-level browse.
//
// The desktop rail and module panel are two columns you read at once. On one
// column the same information becomes a drill-down, and it arrives from the
// bottom rather than the side: the bar that opens it is at the bottom, and a
// sheet that appears where the thumb already is costs no reach.
//
// Level two REUSES <ModulePanel> rather than reimplementing it, so there is
// exactly one answer to "what is in Selling" — including its filter, its section
// headings and its quick-create — and a surface added to the catalog appears on
// both presentations with no second edit.

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
import { useVisibleNav } from '../../lib/surfaces/use-visible-nav';
import { ModuleScope, type WorkbenchModule } from '../module-scope';
import { ModulePanel } from '../module-panel';

interface ModulesSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ModulesSheet({ open, onOpenChange }: ModulesSheetProps) {
  const nav = useVisibleNav();
  // null = the module list; a module = that module's surfaces.
  const [module, setModule] = useState<WorkbenchModule | null>(null);

  const close = () => {
    onOpenChange(false);
    // Reset to level one only AFTER the sheet is shut, so the panel does not
    // visibly snap back while sliding away.
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
      {/* Stops short of the bottom so the nav bar floating over it stays whole. */}
      <DrawerContent side="bottom" className="h-[78dvh] p-0 pb-24">
        {module ? (
          <>
            <DrawerHeader sticky className="gap-2">
              <Button
                variant="ghost"
                className="min-h-13 gap-1"
                onClick={() => {
                  setModule(null);
                }}
              >
                <ChevronLeft className="size-4" aria-hidden />
                All modules
              </Button>
            </DrawerHeader>
            {/* Never pinned: on a phone the panel IS the sheet, and opening
                something has to dismiss it or the screen stays covered. */}
            <ModulePanel
              module={module}
              pinned={false}
              pinnable={false}
              width="fill"
              onTogglePin={() => undefined}
              onDismiss={close}
            />
          </>
        ) : (
          <>
            <DrawerHeader sticky>
              <DrawerTitle>Everything sparx does</DrawerTitle>
            </DrawerHeader>
            {/* Fills the sheet. Left at silica's own 16rem this was a 256px list
                inside a full-width drawer, with every row's tap target narrower
                than the sheet it appears to be part of. */}
            <Sidebar
              collapsed={false}
              color="module"
              aria-label="Modules"
              className="h-full w-full bg-transparent [--sidebar-w:100%]"
            >
              <SidebarContent>
                <SidebarGroup>
                  {nav.map((entry) => (
                    <ModuleScope key={entry.module} module={entry.module}>
                      <SidebarItem
                        // 52px, matching the bar above it. The rail's desktop
                        // density is a mouse affordance and would be a mis-tap
                        // generator here.
                        className="min-h-13"
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
