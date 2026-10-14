'use client';

// The body of the sending addresses list: one card with a row per address, plus
// the waiting and empty states. Not a table: the address IS the row's content.

import { PaneWaiting } from '../../components/pane-waiting';
import { Badge, Button, Card, Heading, Text } from '@wizeworks/silicaui-react';
import { faPaperPlane, faPlus } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { ListEmptyState } from '../../components/list-empty-state';
import { sendingDomainState, type SendingDomain } from './domains-data';

/** Registry module for this surface, so the brand's empty-state artwork is this
 *  app's own picture rather than the generic one. */
const MODULE = 'email';

interface OpenEvent {
  shiftKey: boolean;
  altKey: boolean;
}

function AddressRow({
  domain,
  isDefault,
  onOpen,
}: {
  domain: SendingDomain;
  isDefault: boolean;
  onOpen: (event: OpenEvent) => void;
}) {
  const state = sendingDomainState(domain);
  return (
    <li className="border-base-300 hover:bg-base-200 border-b last:border-b-0">
      <button
        type="button"
        className="flex w-full min-w-0 cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-left"
        onClick={onOpen}
      >
        {/* The address is the content of this row; nothing else gets its size. */}
        <span className="min-w-0 font-mono text-base break-all">{domain.domain}</span>
        {isDefault ? (
          <Badge color="module" variant="soft" size="sm">
            Default here
          </Badge>
        ) : null}
        <span className="flex-1" />
        <Badge color={state.tone} variant="soft" size="sm">
          {state.label}
        </Badge>
      </button>
    </li>
  );
}

function SendingAddressesCard(props: {
  all: SendingDomain[];
  matches: SendingDomain[];
  defaultId: string | null;
  onOpen: (domain: SendingDomain, event: OpenEvent) => void;
}) {
  const { all } = props;
  return (
    // Capped and centered: a pane torn onto a second monitor is otherwise
    // 2000px wide with the status badges a foot from their addresses.
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <section className="card bg-base-100 overflow-hidden">
        <header className="border-base-300 flex flex-wrap items-center gap-2 border-b px-4 py-3">
          <Heading level={2} className="text-base font-semibold">
            Your sending addresses
          </Heading>
          <div className="flex-1" />
          <Text className="text-sm">
            {all.length === 1 ? '1 address' : `${String(all.length)} addresses`}
          </Text>
        </header>
        <ul>
          {props.matches.map((domain) => (
            <AddressRow
              key={domain.id}
              domain={domain}
              isDefault={domain.id === props.defaultId}
              onOpen={(event) => {
                props.onOpen(domain, event);
              }}
            />
          ))}
        </ul>
      </section>
    </div>
  );
}

export function SendingDomainsBody(props: {
  pending: boolean;
  needle: string;
  locked: boolean;
  all: SendingDomain[];
  matches: SendingDomain[];
  defaultId: string | null;
  onOpen: (domain: SendingDomain, event: OpenEvent) => void;
  onAdd: (event: OpenEvent) => void;
}) {
  if (props.pending) {
    return (
      <Card className="min-h-0 flex-1 items-center justify-center">
        <PaneWaiting />
      </Card>
    );
  }
  if (props.matches.length > 0) return <SendingAddressesCard {...props} />;
  return (
    <ListEmptyState
      module={MODULE}
      filtered={props.needle !== ''}
      noResults={{
        icon: <Icon glyph={faPaperPlane} className="size-6" aria-hidden />,
        title: 'No addresses match that',
        description: 'Try part of the address, or clear the search to see them all.',
      }}
      firstRun={{
        title: 'No sending addresses yet',
        description:
          'A sending address is a domain you own that your email goes out from, so customers see mail from your own address, like hello@yourbusiness.com, and it lands in inboxes instead of spam. Add one and add a few records at your domain provider to prove it is yours.',
        actions: props.locked ? undefined : (
          <Button color="module" size="sm" onClick={props.onAdd}>
            <Icon glyph={faPlus} className="size-4" aria-hidden />
            Add a sending address
          </Button>
        ),
      }}
    />
  );
}
