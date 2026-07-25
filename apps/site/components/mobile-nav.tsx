'use client';

// Mobile navigation — hamburger that opens a left slide-in panel. Only shown
// on narrow viewports (the desktop .st-nav is hidden by media query). Closes
// on route selection, Escape, and backdrop click.

import Link from 'next/link';
import { useEffect, useState } from 'react';

import type { NavItem } from './site-header';

export function MobileNav({ nav, brand }: { nav: NavItem[]; brand: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="rounded-field text-base-content hover:bg-base-200 relative inline-flex h-10 w-10 cursor-pointer items-center justify-center transition-colors min-[760px]:hidden"
        aria-label="Open menu"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M3 6h18M3 12h18M3 18h18" />
        </svg>
      </button>

      {open ? (
        <div className="sui-animate-fade-in fixed inset-0 z-[60] bg-black/40" role="presentation">
          <button
            type="button"
            aria-label="Close mobile navigation"
            className="absolute inset-0 h-full w-full cursor-pointer border-0 bg-transparent"
            onClick={() => setOpen(false)}
          />
          <nav
            className="sui-animate-slide-right border-base-300 bg-base-100 absolute top-0 bottom-0 left-0 flex w-[min(420px,90vw)] flex-col border-r"
            aria-label="Mobile navigation"
          >
            <div className="border-base-300 flex items-center justify-between border-b px-5 py-4">
              <span className="text-base-content text-xl font-semibold tracking-tight">
                {brand}
              </span>
              <button
                type="button"
                className="rounded-field text-base-content hover:bg-base-200 relative inline-flex h-10 w-10 cursor-pointer items-center justify-center transition-colors"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="[&_a]:rounded-field [&_a]:text-base-content [&_a]:hover:bg-base-200 flex flex-col p-2 [&_a]:px-3 [&_a]:py-3.5 [&_a]:text-[1.05rem] [&_a]:font-medium [&_a]:no-underline">
              {nav.map((item) => (
                <Link key={item.href} href={item.href} onClick={() => setOpen(false)}>
                  {item.label}
                </Link>
              ))}
            </div>
          </nav>
        </div>
      ) : null}
    </>
  );
}
