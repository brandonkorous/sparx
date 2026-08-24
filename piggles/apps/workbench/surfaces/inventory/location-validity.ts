'use client';

// Whether a draft can be saved, and whether it has moved.
//
// The address is required to CREATE, and required once any of its fields is
// touched on an EDIT — but an untouched edit (a rename) needs no address, which
// is the whole reason this is not a single `required` flag.

import { useMemo } from 'react';
import { addressChanged, BLANK, type Draft } from './location-draft';

export function useLocationValidity(draft: Draft, initial: Draft, isNew: boolean) {
  const nameOk = draft.name.trim() !== '';
  const codeOk = draft.code.trim() !== '';
  const addrTouched = isNew || addressChanged(draft, initial);
  const addrOk =
    draft.line1.trim() !== '' &&
    draft.city.trim() !== '' &&
    /^[A-Z]{2}$/.test(draft.country.trim());
  // The address is required to CREATE, and required once any of its fields is
  // touched on an EDIT — but an untouched edit (a rename) needs no address.
  const addrRequired = isNew || addrTouched;
  const addrValid = !addrRequired || addrOk;
  // Show the "needs a little more" note once the person has engaged the form —
  // on a new location that is the moment they name it or touch an address field,
  // so a disabled Create button always has a reason on screen next to it.
  const anyAddressTyped = Boolean(draft.line1.trim() || draft.city.trim() || draft.country.trim());
  const showAddrWarning =
    addrRequired && !addrOk && (isNew ? nameOk || codeOk || anyAddressTyped : true);

  const changed = useMemo(() => {
    if (isNew) {
      return (
        draft.name.trim() !== '' ||
        draft.code.trim() !== '' ||
        addressChanged(draft, BLANK) ||
        draft.type !== BLANK.type
      );
    }
    return (
      draft.name !== initial.name ||
      draft.code !== initial.code ||
      draft.type !== initial.type ||
      draft.isActive !== initial.isActive ||
      addressChanged(draft, initial)
    );
  }, [draft, initial, isNew]);

  return { nameOk, codeOk, addrValid, showAddrWarning, changed };
}
