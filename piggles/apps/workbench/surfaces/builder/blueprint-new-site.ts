'use client';

// "A new site" as a target for a ready-made design.
//
// A design is a whole site, so adding one to a site that has pages replaces them
// ([363]). The warning that says so tells her to add it to a different site
// instead — which, before this, meant leaving the pane, finding New site,
// creating one, coming back and finding the design again. For the one thing a
// person most wants to do on this screen, that was the whole journey.
//
// So the picker carries an extra target that does not exist yet. Choosing it
// asks for a name, shows the address it would get, and the one button then
// creates the site and puts the design in it.

import { useState } from 'react';
import { slugify } from '../../lib/slugify';

import { useCreateSite } from '../sites/data';
import { useNewSiteAddress } from '../sites/site-address';

/** The picker value that means "a site that does not exist yet". Not a uuid, so
 *  it can never collide with a real one. */
export const NEW_SITE = '__new__';

export interface NewSiteTarget {
  chosen: boolean;
  name: string;
  setName: (value: string) => void;
  /** The address it would be served at, once it has a name. */
  host: string | null;
  /** Why this name cannot be used, in her words. Null when it is fine. */
  problem: string | null;
  /** What the rest of the pane calls it before it exists. */
  label: string;
  ready: boolean;
  creating: boolean;
  /** Create it, and answer with its id. Throws like any other write. */
  create: () => Promise<string>;
  /** Once it exists, point the picker at it and forget the name. Called by the
   *  install's success, so the pane stops offering to make a second one. */
  settle: (id: string) => void;
}

export function useNewSiteTarget(
  targetSite: string,
  chooseSite: (id: string) => void
): NewSiteTarget {
  const [name, setName] = useState('');
  const create = useCreateSite();
  const trimmed = name.trim();
  // The handle is derived and never asked for: this is a one-field detour inside
  // another job, and the full New site form is still there for somebody who
  // wants to choose their own. The same `slugify` that form uses.
  const handle = slugify(trimmed, 63);
  const { host, problem } = useNewSiteAddress(handle);

  return {
    chosen: targetSite === NEW_SITE,
    name,
    setName,
    host,
    problem:
      trimmed === '' ? null : (problem ?? (handle === '' ? 'Use some letters or numbers.' : null)),
    label: trimmed === '' ? 'your new site' : trimmed,
    ready: trimmed !== '' && handle !== '' && problem === null,
    creating: create.isPending,
    create: async () => {
      const site = await create.mutateAsync({ name: trimmed, ...(handle ? { slug: handle } : {}) });
      return site.id;
    },
    settle: (id: string) => {
      chooseSite(id);
      setName('');
    },
  };
}
