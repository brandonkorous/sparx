'use client';

// The grab handle at the top of a bottom sheet.
//
// Silica's Drawer does not draw one — it is edge-agnostic, and a handle only
// means anything on the bottom edge. It is the thing that says "this is a sheet
// you can push back down" before anybody has tried, so a bottom sheet without
// one reads as a screen that arrived rather than a layer you pulled up.
//
// Decorative and non-interactive: dragging is the Drawer's own gesture, and this
// sits inside the region that already listens for it.

export function SheetHandle() {
  return (
    <div className="flex shrink-0 justify-center pt-2 pb-1" aria-hidden>
      <span className="bg-base-300 h-1 w-9 rounded-full" />
    </div>
  );
}
