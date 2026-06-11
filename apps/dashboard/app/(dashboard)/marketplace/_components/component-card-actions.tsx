'use client';

// The per-component action for a marketplace card/detail (docs/60 §10, docs/85).
// Two kinds of component live here:
//   • DATA components carry a node tree — "Add" CLONES it into the tenant's own
//     component library (addComponentAction → copyComponent), no deploy. On a
//     browse card the heavy tree isn't loaded, so we send the user to the detail
//     page to add it.
//   • System-palette pointers (no tree) hand off to the builder catalog at
//     /builder/components/<type>, where the existing "Copy" flow owns it.

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, toast } from '@sparx/ui';

import { addComponentAction } from '../actions';
import type { ComponentFacets } from '../_types';

interface Props {
  slug: string;
  name: string;
  component: ComponentFacets | null;
  // True on the detail page (the tree/propSpec are resolved from storage there);
  // false on browse cards, which only link through to the detail.
  detail?: boolean;
}

export function ComponentCardActions({ slug, name, component, detail = false }: Props) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const tree = component?.tree;

  // Browse card: the tree lives in storage and is resolved only on the detail
  // (docs/85 §7), so every component card routes there — the detail then shows
  // "Add to my components" (clone) for a DATA component, or a builder deep-link
  // for a palette pointer.
  if (!detail) {
    return (
      <Button color="primary" asChild>
        <Link href={`/marketplace/components/${encodeURIComponent(slug)}`}>View component</Link>
      </Button>
    );
  }

  // DATA component on the DETAIL view (tree loaded from storage): clone it.
  if (tree) {
    const onAdd = (): void => {
      startTransition(async () => {
        const res = await addComponentAction({
          name,
          group: component?.group ?? 'content',
          surfaces: component?.surfaces ?? ['page'],
          tree,
          propSpec: component?.propSpec,
        });
        if (res.ok) {
          toast.success(`${name} added to your components`);
          router.push(`/builder/components/${encodeURIComponent(res.data.key)}`);
        } else {
          toast.error("Couldn't add component", { description: res.error.message });
        }
      });
    };
    return (
      <Button color="primary" onClick={onAdd} loading={pending}>
        Add to my components
      </Button>
    );
  }

  // Detail view, no tree → a system-palette pointer: hand off to the builder
  // catalog's copy flow.
  return (
    <Button color="primary" asChild>
      <Link href={`/builder/components/${encodeURIComponent(slug)}`}>Add to my components</Link>
    </Button>
  );
}
