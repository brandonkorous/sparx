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
// Color carries the distinction, because these are not the same news. The first
// three wear `warning` — something needs attention and it is not what you
// expected. The access one is `info`: nothing is wrong, you are simply not the
// audience.

import { useEffect } from 'react';
import { Button, Card, EmptyState, Text } from '@wizeworks/silicaui-react';
import { PaneToolbar, PANE_SHELL } from '../components/pane-toolbar';
import { Ban, HelpCircle, Lock, Building2, type LucideIcon } from 'lucide-react';
import type { SurfaceContext } from '../lib/surfaces/registry';
import { getSurface } from '../lib/surfaces/registry';
import { moduleLabel } from '../lib/surfaces/nav';
import type { UnresolvedReason } from '../lib/workbench/deep-link';

interface Explanation {
  readonly icon: LucideIcon;
  readonly tone: 'warning' | 'info';
  /**
   * Two or three words for the TAB, which is the only part of this visible
   * once the pane is behind another. The catalog titles this surface "Link",
   * which says nothing at all: a person who followed a link from an email and
   * has five tabs open cannot tell which one is the bad news.
   */
  readonly tab: string;
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
      icon: Ban,
      tone: 'warning',
      tab: 'Module not switched on',
      title: name ? `${name} isn't switched on` : "That part of sparx isn't switched on",
      description: name
        ? `This link opens something in ${name}, and this business isn't using ${name} yet. You can turn it on whenever you like. You only pay for the parts you use.`
        : 'This link opens a part of sparx this business is not using yet. You can turn it on whenever you like. You only pay for the parts you use.',
      action: { label: 'See what sparx can do', surface: 'platform.settings.modules' },
    };
  }

  if (reason === 'no-access') {
    const name = moduleNameOf(detail);
    return {
      icon: Lock,
      tone: 'info',
      tab: 'No access',
      title: name ? `You don't have access to ${name}` : "You don't have access to this",
      description: name
        ? `This business uses ${name}, but your account isn't set up to open it. Whoever looks after this business can change that.`
        : "This link opens something your account isn't set up to see. Whoever looks after this business can change that.",
    };
  }

  if (reason === 'site-unavailable') {
    return {
      icon: Building2,
      tone: 'warning',
      tab: 'Another business',
      title: 'That link is for a different business',
      description: `The link says it belongs to “${detail}”, which isn't one of the businesses you can open, or it has been renamed since the link was written. Whoever sent it can send a fresh one.`,
    };
  }

  return {
    icon: HelpCircle,
    tone: 'warning',
    tab: 'Broken link',
    title: "That link doesn't open anything",
    description: `Nothing in sparx lives at “${detail}”. The address may have been cut short on its way here (links sometimes break when they travel through a chat or an email) so it is worth asking for it again.`,
  };
}

export function LinkUnresolvedSurface({ ctx }: { ctx: SurfaceContext }) {
  const reason = (ctx.params.reason ?? 'unknown-path') as UnresolvedReason;
  const detail = ctx.params.detail ?? '';
  const { icon: Icon, tone, tab, title, description, action } = explain(reason, detail);

  // The tab is the part of this a person still sees once the pane is behind
  // something else, and "Link" told them nothing about which of their tabs
  // holds the bad news.
  useEffect(() => {
    ctx.setTitle(tab);
  }, [ctx, tab]);

  return (
    <div className={PANE_SHELL}>
      {/* Every other pane in the console carries a bar, and this one is reached
          by somebody who has just been surprised — the LAST place to drop the
          chrome that tells them where they are. It holds the reason in a word
          and nothing else, because there is nothing here to control. */}
      <PaneToolbar
        label="Link controls"
        status={
          <>
            <Icon className="size-4 shrink-0" aria-hidden />
            <Text as="span" className="min-w-0 truncate text-sm">
              {tab}
            </Text>
          </>
        }
      />
      <div className="grid min-h-0 flex-1 place-items-center overflow-y-auto p-8">
        {/* On a card, like every other pane's content. It was floating on the
            recessed surface. */}
        <Card className="max-w-md p-8">
          <EmptyState
            icon={
              <Icon
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
        </Card>
      </div>
    </div>
  );
}
