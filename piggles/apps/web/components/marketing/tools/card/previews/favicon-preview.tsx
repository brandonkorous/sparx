import { Mark } from '@piggles/brand/react';

/** The size that decides a favicon: a strip of tabs at sixteen pixels, with a
 *  real mark in the live one so the point lands. */
export function FaviconPreview() {
  return (
    <div className="bg-base-300 rounded-field flex w-full items-end gap-1 p-1.5">
      <div className="bg-base-100 flex min-w-0 flex-1 items-center gap-2 rounded-t-md px-2 py-1.5">
        <Mark className="text-primary size-4 shrink-0" />
        <span className="truncate text-xs font-semibold">Piggles</span>
      </div>
      {['Inbox', 'Orders'].map((tab) => (
        <div key={tab} className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 opacity-60">
          <span className="bg-base-content/25 size-4 shrink-0 rounded-[5px]" />
          <span className="truncate text-xs">{tab}</span>
        </div>
      ))}
    </div>
  );
}
