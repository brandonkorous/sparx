'use client';

// The fields for choosing one entry in a compatibility list, a level at a time.
// Shared by a product's picker and the Products list's bulk "What they fit";
// each caller passes its own commit button. State lives in fitment-choice.ts.

import { useMemo, type ReactNode } from 'react';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Button,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Input,
  Select,
  Text,
} from '@wizeworks/silicaui-react';
import { faChevronRight } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { InlineWaiting } from '../../components/inline-waiting';
import type { FitmentDimension, FitmentDomain } from './products-data';
import type { FitmentChoice } from './fitment-choice';

/** Where you are is TEXT, not a disabled button: greyed out means "may not use". */
function Breadcrumb({ choice }: { choice: FitmentChoice }) {
  const { domain, path, setPath } = choice;
  const root = domain?.displayName ?? 'All';
  return (
    <div className="flex flex-wrap items-center gap-1">
      {path.length === 0 ? (
        <Text as="span" className="px-2 text-sm font-medium">
          {root}
        </Text>
      ) : (
        <Button size="sm" variant="ghost" onClick={() => setPath([])}>
          {root}
        </Button>
      )}
      {path.map((step, index) => (
        <span key={step.id} className="flex items-center gap-1">
          <Icon glyph={faChevronRight} className="size-3 shrink-0" aria-hidden />
          {index === path.length - 1 ? (
            <Text as="span" className="px-2 text-sm font-medium">
              {step.name}
            </Text>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setPath((current) => current.slice(0, index + 1))}
            >
              {step.name}
            </Button>
          )}
        </span>
      ))}
    </div>
  );
}

function LoadFailure({ onRetry }: { onRetry: () => void }) {
  return (
    <Alert color="danger" variant="soft">
      <AlertContent>
        <AlertTitle>Could not load the list</AlertTitle>
        <AlertDescription>
          This is a problem reaching the server. Nothing has been changed.
        </AlertDescription>
      </AlertContent>
      <Button size="sm" color="danger" variant="soft" onClick={onRetry}>
        Try again
      </Button>
    </Alert>
  );
}

function Level({ choice }: { choice: FitmentChoice }) {
  const { nodes, domainId, currentLevel, setPath } = choice;
  const children = nodes.data ?? [];
  if (nodes.isPending && domainId !== '') return <InlineWaiting />;
  if (nodes.isError) return <LoadFailure onRetry={() => void nodes.refetch()} />;
  if (children.length === 0) {
    return (
      <Text className="text-sm">
        Nothing more specific than this is listed, so this is as far as it goes.
      </Text>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      <Text className="text-sm font-semibold">{currentLevel?.label ?? 'Narrow it down'}</Text>
      <ul className="flex flex-col">
        {children.map((node) => (
          <li key={node.id}>
            <button
              type="button"
              className="border-base-300 hover:bg-base-200 flex w-full items-center justify-between gap-2 border-b px-2 py-2 text-left"
              onClick={() => setPath((current) => [...current, { id: node.id, name: node.name }])}
            >
              <span className="min-w-0 truncate">{node.name}</span>
              {node.childCount > 0 ? (
                <Icon glyph={faChevronRight} className="size-4 shrink-0" aria-hidden />
              ) : null}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RangeField({ choice, dimension }: { choice: FitmentChoice; dimension: FitmentDimension }) {
  const { drafts, setDrafts } = choice;
  const set = (end: 'min' | 'max', value: string) => {
    setDrafts((current) => ({
      ...current,
      [dimension.key]: {
        min: current[dimension.key]?.min ?? '',
        max: current[dimension.key]?.max ?? '',
        [end]: value,
      },
    }));
  };
  const box = (end: 'min' | 'max', placeholder: string) => (
    <Input
      color="module"
      size="sm"
      type="number"
      inputMode="numeric"
      placeholder={placeholder}
      aria-label={`${dimension.label} ${placeholder.toLowerCase()}`}
      value={drafts[dimension.key]?.[end] ?? ''}
      onChange={(event) => set(end, event.target.value)}
    />
  );
  return (
    <Field>
      <FieldLabel>
        {dimension.label}
        {dimension.unit ? ` (${dimension.unit})` : ''}
      </FieldLabel>
      <div className="flex items-center gap-2">
        {box('min', 'From')}
        <Text aria-hidden>–</Text>
        {box('max', 'To')}
      </div>
      <FieldDescription>
        Leave both blank and this applies whatever the {dimension.label.toLowerCase()}.
      </FieldDescription>
    </Field>
  );
}

function Ranges({ choice }: { choice: FitmentChoice }) {
  return (
    <div className="flex flex-col gap-3">
      <Text className="text-sm font-semibold">Narrow it further (optional)</Text>
      {choice.rangeDimensions.map((dimension) => (
        <RangeField key={dimension.key} choice={choice} dimension={dimension} />
      ))}
      {choice.problem ? (
        <Alert color="warning" variant="soft" role="alert">
          <AlertContent>
            <AlertDescription>{choice.problem}</AlertDescription>
          </AlertContent>
        </Alert>
      ) : null}
    </div>
  );
}

function Note({ choice }: { choice: FitmentChoice }) {
  return (
    <Field>
      <FieldLabel>Note (optional)</FieldLabel>
      <FieldControl
        render={
          <Input
            color="module"
            size="sm"
            value={choice.notes}
            placeholder="Check the measurement first"
            onChange={(event) => choice.setNotes(event.target.value)}
          />
        }
      />
      <FieldDescription>
        Anything you want to remember about this match. Kept with it, for you, and never shown to
        shoppers.
      </FieldDescription>
    </Field>
  );
}

function DomainSelect({ choice, domains, locked }: Omit<Props, 'commit'> & { locked: boolean }) {
  const items = useMemo(() => {
    const out: Record<string, string> = {};
    for (const candidate of domains) out[candidate.id] = candidate.displayName;
    return out;
  }, [domains]);
  return (
    <Field>
      <FieldLabel>What kind of thing</FieldLabel>
      <Select
        color="module"
        size="sm"
        items={items}
        value={choice.domainId}
        disabled={locked}
        aria-label="What kind of thing"
        onValueChange={(next) => choice.setDomainId(next as string)}
      />
      {locked ? (
        <FieldDescription>
          Everything in one go comes from one list. Clear the entries below to switch.
        </FieldDescription>
      ) : null}
    </Field>
  );
}

interface Props {
  choice: FitmentChoice;
  domains: FitmentDomain[];
  /** The caller's "this one" button, right under the breadcrumb at every depth. */
  commit: ReactNode;
}

export function FitmentChooserFields({
  choice,
  domains,
  commit,
  withRanges = true,
  withNotes = true,
  lockDomain = false,
}: Props & { withRanges?: boolean; withNotes?: boolean; lockDomain?: boolean }) {
  return (
    <>
      {domains.length > 1 ? (
        <DomainSelect choice={choice} domains={domains} locked={lockDomain} />
      ) : null}
      <Breadcrumb choice={choice} />
      {commit}
      <Level choice={choice} />
      {withRanges && choice.rangeDimensions.length > 0 ? <Ranges choice={choice} /> : null}
      {withNotes ? <Note choice={choice} /> : null}
    </>
  );
}
