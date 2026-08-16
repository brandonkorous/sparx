'use client';

// A link that went nowhere, explained.
//
// This is a PANE, not an error page, and the difference is the whole design.
// Someone clicking a link in a chat message arrives with their layout intact,
// their other work untouched, and one tab that says what was wrong. They close
// it and carry on. An error page would have taken the workbench away to deliver
// a sentence.
//
// Four things can go wrong with a link and they are genuinely different
// problems, so they get genuinely different answers rather than one shrug:
//
//   • The address means nothing here — a typo, a mail client that mangled the
//     URL, or a link from a build that had a screen this one doesn't.
//   • The screen exists but this account doesn't have that part of sparx. That
//     is a decision the owner can change, so it says which part and offers the
//     way there.
//   • The screen exists, the account has it, this PERSON doesn't. No upsell, no
//     "ask your administrator to buy" — they need to ask someone, and that is a
//     conversation, not a button.
//   • The link is for a different business. Nothing is broken; it just isn't
//     theirs, or the business was renamed after the link was written.
//
// Colour carries the distinction, because these are not the same news. The first
// three wear `warning` — something needs attention and it is not what you
// expected. The access one is `info`: nothing is wrong, you are simply not the
// audience.

import { useEffect } from 'react';
import { Icon } from '@piggles/ui';
import { productCopy, productCopyWith, productHidesSurface } from '../lib/product';
import { Button, EmptyState } from '@wizeworks/silicaui-react';
import { faBan, faBuilding, faCircleQuestion, faLock } from '@fortawesome/pro-solid-svg-icons';
import type { PigglesIcon } from '@piggles/ui';
import type { SurfaceContext } from '../lib/surfaces/registry';
import { getSurface } from '../lib/surfaces/registry';
import { moduleLabel } from '../lib/surfaces/nav';
import type { UnresolvedReason } from '../lib/workbench/deep-link';

interface Explanation {
  readonly icon: PigglesIcon;
  readonly tone: 'warning' | 'info';
  readonly title: string;
  readonly description: string;
  /** An action that can actually resolve this, when one exists. */
  readonly action?: { readonly label: string; readonly surface: string };
}

/**
 * The module a link was pointing into, in the owner's words.
 *
 * `detail` carries a surface key for the two module reasons, so the name comes
 * from the registry rather than from the link — which means a renamed module
 * says its new name, and an unknown key degrades to a sentence that still reads
 * properly rather than printing `commerce.order.detail` at a business owner.
 */
function moduleNameOf(surfaceKey: string): string | null {
  const definition = getSurface(surfaceKey);
  if (!definition) return null;
  return moduleLabel(definition.module);
}

function explain(reason: UnresolvedReason, detail: string): Explanation {
  if (reason === 'module-disabled') {
    const name = moduleNameOf(detail);
    return {
      icon: faBan,
      tone: 'warning',
      title: name
        ? `${name} isn't switched on`
        : productCopy('link.unresolved.title', "That part of sparx isn't switched on"),
      description: name
        ? productCopyWith(
            'link.unresolved.bodyNamed',
            `This link opens something in ${name}, and this business isn't using ${name} yet. You can turn it on whenever you like — you only pay for the parts you use.`,
            { name }
          )
        : productCopy(
            'link.unresolved.body',
            'This link opens an app this business has not switched on yet. You can add it whenever you like, from All apps at the foot of the rail — every app is included, so it never changes what you pay.'
          ),
      action: {
        label: productCopy('link.unresolved.action', 'See what sparx can do'),
        surface: 'platform.settings.modules',
      },
    };
  }

  if (reason === 'no-access') {
    const name = moduleNameOf(detail);
    return {
      icon: faLock,
      tone: 'info',
      title: name ? `You don't have access to ${name}` : "You don't have access to this",
      description: name
        ? `This business uses ${name}, but your account isn't set up to open it. Whoever looks after this business can change that.`
        : "This link opens something your account isn't set up to see. Whoever looks after this business can change that.",
    };
  }

  if (reason === 'site-unavailable') {
    return {
      icon: faBuilding,
      tone: 'warning',
      title: 'That link is for a different business',
      description: `The link says it belongs to “${detail}”, which isn't one of the businesses you can open — or it has been renamed since the link was written. Whoever sent it can send a fresh one.`,
    };
  }

  return {
    icon: faCircleQuestion,
    tone: 'warning',
    title: "That link doesn't open anything",
    description: productCopyWith(
      'link.unknownAddress',
      `Nothing in Piggles lives at “${detail}”. The address may have been cut short on its way here — links sometimes break when they travel through a chat or an email — so it is worth asking for it again.`,
      { detail }
    ),
  };
}

export function LinkUnresolvedSurface({ ctx }: { ctx: SurfaceContext }) {
  const reason = (ctx.params.reason ?? 'unknown-path') as UnresolvedReason;
  const detail = ctx.params.detail ?? '';
  const { icon, tone, title, description, action: suggested } = explain(reason, detail);

  // Drop the action when this product does not HAVE the screen it points at.
  //
  // The one here goes to the modules settings surface, which is where sparx
  // sends somebody whose link opened a module they have not switched on. A brand
  // that hides that surface (Piggles does — it prices one flat plan and manages
  // apps somewhere else entirely) would otherwise render a primary button that
  // opens a pane the product has decided nobody should reach.
  //
  // A missing button is the right answer rather than a different one: the
  // sentence above already says what to do, and inventing a destination here
  // would mean this file knowing which brand it is running under.
  const action = suggested && !productHidesSurface(suggested.surface) ? suggested : undefined;

  useEffect(() => {
    ctx.setTitle('Link');
  }, [ctx]);

  return (
    <div className="grid h-full place-items-center overflow-y-auto p-8">
      <EmptyState
        className="max-w-md"
        icon={
          <Icon
            glyph={icon}
            className={tone === 'info' ? 'text-info size-8' : 'text-warning size-8'}
            aria-hidden
          />
        }
        title={title}
        description={description}
        actions={
          <div className="flex flex-wrap items-center justify-center gap-2">
            {action ? (
              <Button
                color="primary"
                onClick={() => {
                  ctx.open(action.surface, undefined, { target: 'replace' });
                }}
              >
                {action.label}
              </Button>
            ) : null}
            <Button
              color="neutral"
              variant={action ? 'outline' : 'solid'}
              onClick={() => {
                ctx.close();
              }}
            >
              Close
            </Button>
          </div>
        }
      />
    </div>
  );
}
