'use client';

// The `commerce.product-save` control — the heart a shopper presses to keep a
// product for later.
//
// It follows the buy box. Saved items key on a VERSION, so a control that always
// saved the first one would file a size 8 under a shopper looking at the 14. The
// buy box on the same page already holds that choice in a form field named
// `variantId`, so this watches that field rather than asking for its own picker:
// two version pickers on one product page is two answers to one question.
//
// A signed-out shopper is sent to sign in and brought back where they were, which
// is what the previous generation's heart did and the only behavior that does not
// lose their place.

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import { useCustomer } from '@/components/customer-provider';
import { useWishlist } from '@/components/wishlist-provider';
import {
  chooseFirstText,
  saveButtonAria,
  saveButtonText,
  variantToSave,
} from './product-save-words';

export interface ProductSaveViewProps {
  /** Every version this product has, so a stale form value can be refused. */
  variantIds: string[];
  label: string;
  savedLabel: string;
}

/** The buy box's version field, wherever on the page it is. */
function readChosenVariant(): string | null {
  if (typeof document === 'undefined') return null;
  const field = document.querySelector<HTMLInputElement>(
    'input[name="variantId"]:checked, input[type="hidden"][name="variantId"]'
  );
  return field?.value ?? null;
}

export function ProductSaveView({ variantIds, label, savedLabel }: ProductSaveViewProps) {
  const { status } = useCustomer();
  const { has, toggle } = useWishlist();
  const router = useRouter();
  const pathname = usePathname();

  const [chosen, setChosen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // The radios are plain form inputs owned by the authored buy box, not React
  // state this component can subscribe to, so the change is heard on the document.
  // `input` as well as `change`, because a hidden field swapped by a re-render
  // fires neither — hence the read on mount too.
  useEffect(() => {
    const sync = () => {
      setChosen(readChosenVariant());
    };
    sync();
    document.addEventListener('change', sync);
    document.addEventListener('input', sync);
    return () => {
      document.removeEventListener('change', sync);
      document.removeEventListener('input', sync);
    };
  }, []);

  const variantId = variantToSave(chosen, variantIds);
  const saved = variantId !== null && has(variantId);
  const words = { label, savedLabel };

  // Only a real "nobody is signed in" goes to sign in. While the session is
  // still being read, or the shop could not be reached to read it, the button
  // waits (disabled below) rather than sending a signed-in shopper to the
  // sign-in page (persona issue 086).
  const unknown = status === 'loading' || status === 'unreachable';

  async function onClick() {
    if (!variantId) return;
    if (status === 'anonymous') {
      router.push(`/account/login?redirect=${encodeURIComponent(pathname || '/')}`);
      return;
    }
    if (status !== 'authenticated') return;
    setBusy(true);
    try {
      await toggle(variantId);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className={[
        'rounded-field bg-base-100 focus-visible:outline-primary inline-flex cursor-pointer items-center gap-2 border px-3 py-2 text-base transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed',
        saved
          ? 'border-danger/40 text-danger'
          : 'border-base-300 text-base-content hover:border-primary hover:text-primary',
      ].join(' ')}
      aria-pressed={saved}
      aria-label={saveButtonAria(saved, words)}
      // Says why it cannot be pressed rather than sitting dead. A product with
      // several versions and none chosen is the ordinary first second on the page.
      title={
        variantId === null
          ? chooseFirstText()
          : status === 'unreachable'
            ? 'We couldn’t reach your account just now. Try again in a moment.'
            : undefined
      }
      disabled={busy || variantId === null || unknown}
      onClick={() => void onClick()}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill={saved ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
      </svg>
      <span>{variantId ? saveButtonText(saved, words) : chooseFirstText()}</span>
    </button>
  );
}
