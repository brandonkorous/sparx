'use client';

// Create a brand-new tenant component from scratch (docs/53) — the first-class
// "New component" path on the catalog, alongside Copy (from a system component)
// and "Save as component" (from a canvas selection). Seeds a blank Section as the
// root (an empty container to compose into), auto-keys it server-side, and opens
// the component tree editor.

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Button } from '@sparx/ui';

import { makeNode } from '../../_builder/registry';
import { copyComponent } from '../_lib/component-actions';

export function NewComponentButton() {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  const onCreate = async () => {
    setBusy(true);
    const res = await copyComponent({
      name: 'Untitled component',
      group: 'layout',
      icon: 'box',
      surfaces: ['page'],
      tree: makeNode('Section'),
    });
    setBusy(false);
    if (res.ok && res.data) router.push(`/builder/components/${res.data.key}/edit`);
  };

  return (
    <Button
      size="sm"
      variant="solid"
      leftIcon={<Plus className="h-4 w-4" />}
      disabled={busy}
      onClick={() => void onCreate()}
    >
      New
    </Button>
  );
}
