'use client';

// Choosing ONE entry in a compatibility list, one level at a time, with optional
// years (or whatever the list narrows by) and an optional note.
//
// Shared by the product's own "What it fits" picker and the Products list's bulk
// "Set what it fits". The state is a hook and the fields are a component, so
// each caller supplies its own commit buttons: the product picker writes the
// rule straight away, the bulk dialog adds it to a list of entries to apply.
//
// ── Why it drills instead of listing ────────────────────────────────────────
//
// A real vehicle dictionary is tens of thousands of entries. So it is a column
// navigator: one level at a time, a breadcrumb of where you are, and "it fits
// everything under here" available at every step, because a rule that stops at
// Ford is a legitimate and common thing to mean, not a half-finished one.

import { useMemo, useState, type ReactNode } from 'react';
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
import { ChevronRight } from 'lucide-react';
import {
  useFitmentNodes,
  type FitmentDimension,
  type FitmentDomain,
  type ProductFitmentRange,
} from './products-data';
import { rangesFromDrafts, ruleTitle, type RangeDraft } from './fitment-rule-words';

interface Step {
  id: string;
  name: string;
}

/** A rule chosen here and not yet written anywhere. `nodePath` rides along so
 *  whatever announces it can name it. */
export interface ChosenRule {
  domainId: string;
  nodeId: string | null;
  nodePath: string[];
  ranges: ProductFitmentRange[];
  notes: string | null;
}

export function useFitmentChoice(domains: FitmentDomain[], enabled: boolean) {
  const [domainId, setDomainIdState] = useState(domains[0]?.id ?? '');
  const [path, setPath] = useState<Step[]>([]);
  const [drafts, setDrafts] = useState<Record<string, RangeDraft>>({});
  const [notes, setNotes] = useState('');

  const domain = domains.find((candidate) => candidate.id === domainId);
  const parentId = path.length > 0 ? (path[path.length - 1]?.id ?? null) : null;
  const nodes = useFitmentNodes(enabled && domainId !== '' ? domainId : null, parentId);
  const dimensions = domain?.dimensions ?? [];
  const rangeDimensions = dimensions.filter((d) => d.kind === 'range');
  const currentLevel = dimensions.filter((d) => d.kind === 'level')[path.length];
  const { ranges, problem } = rangesFromDrafts(rangeDimensions, drafts);

  const clearDetails = () => {
    setDrafts({});
    setNotes('');
  };

  return {
    domainId,
    domain,
    path,
    setPath,
    drafts,
    setDrafts,
    notes,
    setNotes,
    nodes,
    rangeDimensions,
    currentLevel,
    problem,
    /** Mid-sentence name of where the drill-down stands: "Chevrolet › Silverado". */
    here: ruleTitle({ nodePath: path.map((step) => step.name) }, domain, 'mid'),
    /** Holding anything someone would be sorry to lose. */
    started:
      path.length > 0 ||
      notes.trim() !== '' ||
      Object.values(drafts).some((d) => d.min.trim() !== '' || d.max.trim() !== ''),
    setDomainId: (next: string) => {
      setDomainIdState(next);
      setPath([]);
      clearDetails();
    },
    /** The rule as it stands, or null while the windows have a problem. */
    build: (): ChosenRule | null => {
      if (domainId === '' || problem !== null) return null;
      return {
        domainId,
        nodeId: parentId,
        nodePath: path.map((step) => step.name),
        ranges,
        notes: notes.trim() === '' ? null : notes.trim(),
      };
    },
    reset: () => {
      setPath([]);
      clearDetails();
    },
    /** After choosing one engine, back up to its model so the next is one click. */
    stepUp: () => {
      setPath((current) => current.slice(0, -1));
      clearDetails();
    },
  };
}

export type FitmentChoice = ReturnType<typeof useFitmentChoice>;

function Breadcrumb({ choice }: { choice: FitmentChoice }) {
  const { domain, path, setPath } = choice;
  // WHERE YOU ARE IS TEXT, not a disabled button: this console draws something
  // you MAY NOT USE greyed out, and the step you are on is not that.
  return (
    <div className="flex flex-wrap items-center gap-1">
      {path.length === 0 ? (
        <Text as="span" className="px-2 text-sm font-medium">
          {domain?.displayName ?? 'All'}
        </Text>
      ) : (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setPath([]);
          }}
        >
          {domain?.displayName ?? 'All'}
        </Button>
      )}
      {path.map((step, index) => (
        <span key={step.id} className="flex items-center gap-1">
          <ChevronRight className="size-3 shrink-0" aria-hidden />
          {index === path.length - 1 ? (
            <Text as="span" className="px-2 text-sm font-medium">
              {step.name}
            </Text>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setPath((current) => current.slice(0, index + 1));
              }}
            >
              {step.name}
            </Button>
          )}
        </span>
      ))}
    </div>
  );
}

function Level({ choice }: { choice: FitmentChoice }) {
  const { nodes, domainId, currentLevel, setPath } = choice;
  const children = nodes.data ?? [];
  if (nodes.isPending && domainId !== '') {
    return (
      <p className="text-sm" role="status">
        Loading…
      </p>
    );
  }
  if (nodes.isError) {
    return (
      <Alert color="danger" variant="soft">
        <AlertContent>
          <AlertTitle>Could not load the list</AlertTitle>
          <AlertDescription>
            This is a problem reaching the server. Nothing has been changed.
          </AlertDescription>
        </AlertContent>
        <Button
          size="sm"
          color="danger"
          variant="soft"
          onClick={() => {
            void nodes.refetch();
          }}
        >
          Try again
        </Button>
      </Alert>
    );
  }
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
            {/* A real <button>: keyboard reach and focus come free and correct. */}
            <button
              type="button"
              className="border-base-300 hover:bg-base-200 flex w-full items-center justify-between gap-2 border-b px-2 py-2 text-left"
              onClick={() => {
                setPath((current) => [...current, { id: node.id, name: node.name }]);
              }}
            >
              <span className="min-w-0 truncate">{node.name}</span>
              {node.childCount > 0 ? (
                <ChevronRight className="size-4 shrink-0" aria-hidden />
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
  return (
    <Field>
      <FieldLabel>
        {dimension.label}
        {dimension.unit ? ` (${dimension.unit})` : ''}
      </FieldLabel>
      <div className="flex items-center gap-2">
        <Input
          color="module"
          size="sm"
          type="number"
          inputMode="numeric"
          placeholder="From"
          aria-label={`${dimension.label} from`}
          value={drafts[dimension.key]?.min ?? ''}
          onChange={(event) => {
            set('min', event.target.value);
          }}
        />
        <Text aria-hidden>–</Text>
        <Input
          color="module"
          size="sm"
          type="number"
          inputMode="numeric"
          placeholder="To"
          aria-label={`${dimension.label} to`}
          value={drafts[dimension.key]?.max ?? ''}
          onChange={(event) => {
            set('max', event.target.value);
          }}
        />
      </div>
      <FieldDescription>
        Leave both blank and this applies whatever the {dimension.label.toLowerCase()}.
      </FieldDescription>
    </Field>
  );
}

/**
 * The drill-down and its details. `commit` is the caller's button for "this
 * one", placed right under the breadcrumb at every depth, because stopping here
 * is a first-class answer rather than something found by not clicking.
 */
export function FitmentChooserFields({
  choice,
  domains,
  commit,
  withRanges = true,
  withNotes = true,
  lockDomain = false,
}: {
  choice: FitmentChoice;
  domains: FitmentDomain[];
  commit: ReactNode;
  withRanges?: boolean;
  withNotes?: boolean;
  /** Keep the list fixed: entries already gathered all belong to it. */
  lockDomain?: boolean;
}) {
  const domainItems = useMemo(() => {
    const items: Record<string, string> = {};
    for (const candidate of domains) items[candidate.id] = candidate.displayName;
    return items;
  }, [domains]);

  return (
    <>
      {domains.length > 1 ? (
        <Field>
          <FieldLabel>What kind of thing</FieldLabel>
          <Select
            color="module"
            size="sm"
            items={domainItems}
            value={choice.domainId}
            disabled={lockDomain}
            aria-label="What kind of thing"
            onValueChange={(next) => {
              choice.setDomainId(next as string);
            }}
          />
          {lockDomain ? (
            <FieldDescription>
              Everything in one go comes from one list. Clear the entries below to switch.
            </FieldDescription>
          ) : null}
        </Field>
      ) : null}

      <Breadcrumb choice={choice} />
      {commit}
      <Level choice={choice} />

      {withRanges && choice.rangeDimensions.length > 0 ? (
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
      ) : null}

      {withNotes ? (
        <Field>
          <FieldLabel>Note (optional)</FieldLabel>
          <FieldControl
            render={
              <Input
                color="module"
                size="sm"
                value={choice.notes}
                placeholder="Check the measurement first"
                onChange={(event) => {
                  choice.setNotes(event.target.value);
                }}
              />
            }
          />
          <FieldDescription>
            Anything you want to remember about this match. Kept with it, for you, and never shown
            to shoppers.
          </FieldDescription>
        </Field>
      ) : null}
    </>
  );
}
