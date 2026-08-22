'use client';

// One web address, as a row in the list.
//
// The row's own action is a real <button>, not a div wearing role="button": it
// has to be keyboard-reachable, and it cannot legally contain the external link
// (an anchor inside a button is invalid and unreachable by keyboard). So the link
// is the button's SIBLING, and the <li> is only the hover surface holding the two
// together.

import { Badge } from '@wizeworks/silicaui-react';
import { faArrowUpRightFromSquare } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { domainState, type Domain } from './data';

export function AddressRow({
  domain,
  onOpen,
}: {
  domain: Domain;
  onOpen: (event: { shiftKey: boolean; altKey: boolean }) => void;
}) {
  const state = domainState(domain);
  const isLive = state.tone === 'success';

  return (
    <li className="border-base-300 hover:bg-base-200 flex items-center gap-2 border-b px-4 last:border-b-0">
      <button
        type="button"
        className="flex min-w-0 flex-1 cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 py-3 text-left"
        onClick={onOpen}
      >
        {/* The address is the content of this row — everything else is a note
            about it, so nothing else gets to be the same size. */}
        <span className="min-w-0 font-mono text-base break-all">{domain.host}</span>
        {domain.isCanonical ? (
          <Badge color="module" variant="soft" size="sm">
            Main
          </Badge>
        ) : null}
        <span className="flex-1" />
        <Badge color={state.tone} variant="soft" size="sm">
          {state.label}
        </Badge>
      </button>

      {/* Only offered once it actually resolves — a link to a pending address
          is a dead tab. The placeholder keeps the state badges in one column
          whether or not a row has a link, so the eye runs straight down them. */}
      {isLive ? (
        <a
          href={`https://${domain.host}`}
          target="_blank"
          rel="noreferrer"
          aria-label={`Open ${domain.host} in a new tab`}
          title={`Open ${domain.host} in a new tab`}
          className="link inline-flex shrink-0 items-center py-3"
        >
          <Icon glyph={faArrowUpRightFromSquare} className="size-4" aria-hidden />
        </a>
      ) : (
        <span className="inline-block size-4 shrink-0" aria-hidden />
      )}
    </li>
  );
}
