'use client';

// Copy a SYSTEM component into a new tenant component (docs/53 §8 — the seed UX,
// "start from Button → our brand CTA"). The starting tree is built client-side
// from the registry via makeNode; the action derives a unique key and creates
// the row, then we open the new component's detail.

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Copy } from 'lucide-react';
import { Button } from '@sparx/ui';
import type { ComponentSurface } from '@sparx/builder-schemas';

import { getDef, makeNode } from '../../_builder/registry';
import { copyComponent } from '../_lib/component-actions';

export function CopyComponentButton({ systemType, label }: { systemType: string; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  const onCopy = async () => {
    const def = getDef(systemType);
    if (!def) return;
    setBusy(true);
    const surfaces = (def.surfaces ?? ['page', 'site']).filter(
      (s): s is ComponentSurface => s === 'page' || s === 'site' || s === 'email'
    );
    const res = await copyComponent({
      name: `${label} copy`,
      group: def.group,
      icon: 'box',
      surfaces: surfaces.length > 0 ? surfaces : ['page'],
      tree: makeNode(systemType),
    });
    setBusy(false);
    if (res.ok && res.data) router.push(`/builder/components/${res.data.key}`);
  };

  return (
    <Button
      size="sm"
      variant="soft"
      leftIcon={<Copy className="h-3.5 w-3.5" />}
      disabled={busy}
      onClick={() => void onCopy()}
    >
      Copy to my components
    </Button>
  );
}
