'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ExternalLink, Star } from 'lucide-react';
import { toast } from '@sparx/ui';
import { Button, Tooltip } from '@wizeworks/silicaui-react';

import { makeSitePrimary, setActiveSite, type ActionResult } from '../../actions';

// The site's lifecycle actions, teleported into the detail frame's header bar
// (docs/86 §5.1) alongside the status badges — never a bespoke in-body "Status"
// card. The primary action (Switch to editing) keeps its label; the secondary
// actions (View live, Make primary) go icon-only with a tooltip so the header
// fits one row in a drawer.
export function SiteLifecycleActions({
  propertyId,
  name,
  isActive,
  isPrimary,
  host,
}: {
  propertyId: string;
  name: string;
  isActive: boolean;
  isPrimary: boolean;
  host: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const run = (action: () => Promise<ActionResult>, success: string) => {
    startTransition(async () => {
      const res = await action();
      if (res.ok) {
        toast.success(success);
        router.refresh();
      } else {
        toast.error(res.error ?? 'Something went wrong.');
      }
    });
  };

  return (
    <>
      {host && (
        <Tooltip content="View live site">
          <Button
            variant="ghost"
            size="sm"
            aria-label="View live site"
            render={
              <a
                href={`https://${host}`}
                target="_blank"
                rel="noreferrer"
                aria-label="View live site"
              />
            }
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
        </Tooltip>
      )}

      {!isPrimary && (
        <Tooltip content="Make primary site">
          <Button
            variant="ghost"
            size="sm"
            aria-label="Make primary site"
            disabled={pending}
            onClick={() => run(() => makeSitePrimary(propertyId), `“${name}” is now primary.`)}
          >
            <Star className="h-4 w-4" />
          </Button>
        </Tooltip>
      )}

      {!isActive && (
        <Button
          color="module"
          size="sm"
          disabled={pending}
          onClick={() => run(() => setActiveSite(propertyId), `Now editing “${name}”.`)}
        >
          Switch to editing
        </Button>
      )}
    </>
  );
}
