'use client';

// One product on the core charge choices screen: what it sells as today, what it
// becomes, and the words when a buyer's price moves (issue 057).

import {
  Badge,
  Button,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  FieldStatus,
  Heading,
  Switch,
  Text,
} from '@wizeworks/silicaui-react';
import { MoneyCentsInput } from '../../components/money-input';
import { formatMoney } from './data';
import type { CoreChoiceCandidate } from './core-choices-data';
import {
  blockedBy,
  priceShift,
  rowState,
  sharesOnePrice,
  type ChoiceDraft,
} from './core-choice-words';

interface CardProps {
  candidate: CoreChoiceCandidate;
  draft: ChoiceDraft;
  busy: boolean;
  locked: boolean;
  failed: string | null;
  onEdit: (change: Partial<ChoiceDraft>) => void;
  onOpen: () => void;
  onChange: () => void;
}

function TodayPrices({ candidate }: { candidate: CoreChoiceCandidate }) {
  const sides = [
    [candidate.depositLabel, candidate.depositSidePriceCents],
    [candidate.firstLabel, candidate.firstSidePriceCents],
  ] as const;
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <Heading level={3} className="text-base font-semibold">
        Sold today as
      </Heading>
      <dl className="flex flex-col gap-1">
        {sides.map(([label, cents]) => (
          <div key={label} className="flex items-baseline justify-between gap-3">
            <dt className="min-w-0">“{label}”</dt>
            <dd className="tabular-nums">{formatMoney(cents / 100, candidate.currency)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function MoneyField({
  label,
  hint,
  cents,
  problem,
  locked,
  onEdit,
}: {
  label: string;
  hint: string;
  cents: number | undefined;
  problem: string | null;
  locked: boolean;
  onEdit: (cents: number | undefined, problem: string | null) => void;
}) {
  return (
    <Field className="min-w-0 flex-1">
      <FieldLabel required>{label}</FieldLabel>
      <FieldControl
        render={
          <MoneyCentsInput
            color={problem ? 'error' : 'module'}
            size="sm"
            cents={cents}
            disabled={locked}
            onCentsChange={(reading) => {
              onEdit(reading.cents, reading.problem);
            }}
          />
        }
      />
      <FieldDescription>{hint}</FieldDescription>
    </Field>
  );
}

function SendFirstField({ draft, locked, onEdit }: Pick<CardProps, 'draft' | 'locked' | 'onEdit'>) {
  return (
    <Field>
      <FieldLabel>Buyers can still send their old part first</FieldLabel>
      <FieldControl
        render={
          <Switch
            color="module"
            checked={draft.offerFirst}
            disabled={locked}
            onCheckedChange={(next: boolean) => {
              onEdit({ offerFirst: next });
            }}
          />
        }
      />
      <FieldDescription>No deposit. The part is held until the old one arrives.</FieldDescription>
    </Field>
  );
}

function NewPrices({
  candidate,
  draft,
  locked,
  onEdit,
}: Pick<CardProps, 'candidate' | 'draft' | 'locked' | 'onEdit'>) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3">
      <Heading level={3} className="text-base font-semibold">
        Becomes
      </Heading>
      <div className="flex flex-col gap-3 @md:flex-row">
        {sharesOnePrice(candidate) ? (
          <MoneyField
            label="Part price"
            hint="What the part costs on its own."
            cents={draft.partCents}
            problem={draft.partProblem}
            locked={locked}
            onEdit={(partCents, partProblem) => {
              onEdit({ partCents, partProblem });
            }}
          />
        ) : (
          <Text className="min-w-0 flex-1">
            It has other choices too, so each of its {candidate.groups} versions keeps its own
            price: today’s old-part-first price.
          </Text>
        )}
        <MoneyField
          label="Core deposit"
          hint="Paid back when the old part comes in."
          cents={draft.depositCents}
          problem={draft.depositProblem}
          locked={locked}
          onEdit={(depositCents, depositProblem) => {
            onEdit({ depositCents, depositProblem });
          }}
        />
      </div>
      <SendFirstField draft={draft} locked={locked} onEdit={onEdit} />
    </div>
  );
}

/** One sentence, the most specific: what blocks the row, or why it did not change. */
function RowNotes({ candidate, draft, failed }: Pick<CardProps, 'candidate' | 'draft' | 'failed'>) {
  const shift = priceShift(candidate, draft);
  const blocked = blockedBy(candidate, draft);
  const needsDeposit = draft.depositCents === undefined || draft.depositCents <= 0;
  return (
    <>
      {shift ? <Text className="font-medium">{shift}</Text> : null}
      {blocked ? (
        <FieldStatus status={needsDeposit ? 'warning' : 'error'}>{blocked}</FieldStatus>
      ) : null}
      {failed ? <FieldStatus status="error">{failed}</FieldStatus> : null}
    </>
  );
}

export function ChoiceCard(props: CardProps) {
  const { candidate, draft } = props;
  const state = rowState(candidate, draft);
  return (
    <section className="card bg-base-100 flex flex-col gap-4 p-4">
      <div className="border-base-300 flex items-start justify-between gap-3 border-b pb-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <Heading level={2} className="text-lg font-semibold">
            <button type="button" className="link link-hover text-left" onClick={props.onOpen}>
              {candidate.title}
            </button>
          </Heading>
          <span className="font-mono text-sm break-all">{candidate.keptSku}</span>
        </div>
        <Badge color={state.tone} variant="soft" size="sm" className="shrink-0">
          {state.label}
        </Badge>
      </div>
      <div className="flex flex-col gap-4 @2xl:flex-row">
        <TodayPrices candidate={candidate} />
        <NewPrices
          candidate={candidate}
          draft={draft}
          locked={props.locked}
          onEdit={props.onEdit}
        />
      </div>
      <RowNotes candidate={candidate} draft={draft} failed={props.failed} />
      <div className="flex justify-end">
        <Button
          size="sm"
          color="module"
          variant="outline"
          disabled={blockedBy(candidate, draft) !== null || props.locked}
          loading={props.busy}
          onClick={props.onChange}
        >
          Change this one
        </Button>
      </div>
    </section>
  );
}
