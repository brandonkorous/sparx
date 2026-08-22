'use client';

// "Why is this 74?" — the score, and the reasons behind it (docs/144 §10).
//
// ══════════════════════════════════════════════════════════════════════════
// A SCORE NOBODY CAN SEE IS A SCORE NOBODY USES
// ══════════════════════════════════════════════════════════════════════════
//
// The scoring engine computed a number, stored it on the record, wrote an event
// row for every change, and served a breakdown endpoint — and no screen ever
// asked for any of it. A business owner could write rules, press "Re-score
// everyone", be told "142 of 300 scores changed", and then have nowhere at all
// to see a single one of them. The rules editor was a form that fed a void.
//
// So this panel is the other end of it, and it answers three questions in the
// order somebody actually asks them:
//
//   1. What is the number, and is that good?      → the figure + a band
//   2. Why is it that number?                     → the rules that matched
//   3. I disagree — can I change it?              → adjust, with a reason
//
// THE "NO MODEL" STATE IS THE COMMON ONE AND IT IS NOT AN ERROR. A business
// that has never set up scoring has no model, so every record sits at zero. The
// panel says that in words and points at the screen that fixes it. Rendering a
// confident "0" instead would read as "we scored them and they came out
// worthless", which is a lie about a customer.

import { useState } from 'react';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Field,
  FieldLabel,
  Input,
  Text,
  useToast,
} from '@wizeworks/silicaui-react';
import { faGauge } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { FormSection } from '../../components/form-section';
import { useTeamRoster } from '../../lib/api/team';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import {
  scoreBand,
  SOURCE_LABEL,
  useActiveScoringModel,
  useAdjustScore,
  useScoreBreakdown,
  useScoreHistory,
  type ScoreEventRow,
} from './scoring-data';

/** When a score was last worked out, in words. */
function scoredWhen(iso: string | null): string {
  if (iso === null) return 'Not worked out yet';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Not worked out yet';
  return `Worked out ${date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })}`;
}

function eventWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/* ── Changing it by hand ────────────────────────────────────────────────── */

/**
 * Move a score by hand, with a reason attached.
 *
 * The reason is REQUIRED, and not out of bureaucracy: a hand-moved score is the
 * one entry in the history that the rules cannot explain, so without a sentence
 * saying why, next month's reader finds an unexplained jump and stops trusting
 * every other number on the panel. The engine records who did it too.
 *
 * The change is PERMANENT — it is banked as a standing offset the evaluator
 * adds to every future rules total. It used to survive only until the next
 * re-score, which made the platform's one manual lever a thing you had to keep
 * re-applying and quietly taught people not to use it.
 */
function AdjustScore({ objectKey, recordId }: { objectKey: string; recordId: string }) {
  const toast = useToast();
  const adjust = useAdjustScore();
  const [open, setOpen] = useState(false);
  const [delta, setDelta] = useState('10');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <Button
        variant="outline"
        color="neutral"
        size="sm"
        className="self-start"
        onClick={() => {
          setOpen(true);
        }}
      >
        Change this by hand
      </Button>
    );
  }

  const parsed = Number(delta);
  const valid = Number.isFinite(parsed) && Math.round(parsed) !== 0 && reason.trim() !== '';

  const apply = (): void => {
    setError(null);
    adjust.mutate(
      { objectKey, recordId, delta: Math.round(parsed), reason: reason.trim() },
      {
        onSuccess: (result) => {
          toast.add({ title: `Score is now ${String(result.score)}`, type: 'success' });
          setOpen(false);
          setReason('');
        },
        onError: (e: unknown) => {
          setError(
            e instanceof Error ? e.message : 'Could not change the score. Nothing was changed.'
          );
        },
      }
    );
  };

  return (
    <div className="border-base-300 flex flex-col gap-3 rounded-lg border p-3">
      {error ? (
        <Alert color="danger" variant="soft">
          <AlertContent>
            <AlertDescription>{error}</AlertDescription>
          </AlertContent>
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-3 @2xl:grid-cols-[8rem_minmax(0,1fr)]">
        <Field>
          <FieldLabel>Points to add</FieldLabel>
          <Input
            color="module"
            type="number"
            min={-1000}
            max={1000}
            value={delta}
            onChange={(e) => {
              setDelta(e.target.value);
            }}
          />
        </Field>
        <Field>
          <FieldLabel>Why</FieldLabel>
          <Input
            color="module"
            placeholder="e.g. Met them at the trade show — very keen"
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
            }}
          />
        </Field>
      </div>

      <Text className="text-sm">
        Use a minus sign to take points away. This shows in the history below with your name on it,
        and it sticks: re-scoring everyone keeps your adjustment and only recalculates the rules
        part. It applies to this one record — anything true of everybody belongs in a rule.
      </Text>

      <div className="flex gap-2">
        <Button
          color="module"
          size="sm"
          disabled={!valid}
          loading={adjust.isPending}
          onClick={apply}
        >
          Apply
        </Button>
        <Button
          variant="ghost"
          color="neutral"
          size="sm"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

/* ── History ────────────────────────────────────────────────────────────── */

/**
 * One change to the score, and WHO made it.
 *
 * The engine has always recorded `actorId` on a hand adjustment; nothing ever
 * rendered it, so the history said "Changed by hand" and left the reader to
 * guess by whom. That is the one row on the panel the rules cannot account for
 * — the whole reason it is written down is that a person stands behind it, and
 * an anonymous override invites exactly the suspicion the history exists to
 * prevent. The rest of the sources are the machine acting on its own rules and
 * correctly carry no name.
 */
function HistoryRow({ event, actorName }: { event: ScoreEventRow; actorName: string | null }) {
  return (
    <li className="flex items-baseline gap-3 py-1.5">
      <Badge color={event.delta >= 0 ? 'success' : 'warning'} variant="soft" size="sm">
        {event.delta >= 0 ? '+' : ''}
        {event.delta}
      </Badge>
      <span className="min-w-0 flex-1">
        <Text as="span" className="font-medium">
          {SOURCE_LABEL[event.source]}
        </Text>
        {actorName === null ? null : (
          <Text as="span" className="text-sm">
            {' by '}
            {actorName}
          </Text>
        )}
        {event.reason !== null && event.reason !== '' ? (
          <Text as="span" className="text-sm">
            {' — '}
            {event.reason}
          </Text>
        ) : null}
      </span>
      <Text as="span" className="shrink-0 text-sm tabular-nums">
        {eventWhen(event.occurredAt)}
      </Text>
    </li>
  );
}

/* ── The panel ──────────────────────────────────────────────────────────── */

export function ScorePanel({
  ctx,
  objectKey,
  recordId,
  score,
  scoredAt,
  /** The standing hand adjustment on this record, in points. Zero for almost
   *  everybody — it is what makes the difference between the two numbers
   *  explainable rather than mysterious. */
  scoreOffset,
  /** The bare word for this kind of record — "customer", "deal". Bare rather
   *  than "this customer" because the copy needs it both ways: "what makes A
   *  customer worth chasing" and "what your rules make of THIS customer". */
  noun,
}: {
  ctx: SurfaceContext;
  objectKey: string;
  recordId: string;
  score: number;
  scoredAt: string | null;
  scoreOffset: number;
  noun: string;
}) {
  const model = useActiveScoringModel(objectKey);
  const { data: breakdown } = useScoreBreakdown(objectKey, recordId);
  const { data: historyPage } = useScoreHistory(objectKey, recordId);
  const history = historyPage?.items ?? [];

  // `actorId` is a user id; the roster is what turns it into a person. Falls
  // back to null rather than to the raw id — a uuid in the sentence is worse
  // than no name at all, and it happens legitimately when whoever made the
  // change has since left the team.
  const { members } = useTeamRoster();
  const actorName = (actorId: string | null): string | null => {
    if (actorId === null) return null;
    const person = members.find((m) => m.userId === actorId);
    return person ? (person.name ?? person.email) : null;
  };

  // Nobody has said what makes one of these worth chasing. That is a setup step,
  // not a failure, so it reads as an invitation and links to the screen that does
  // it — rather than a zero nobody can account for.
  if (model === null) {
    return (
      <FormSection title="Score">
        <Alert color="module" variant="soft">
          <Icon glyph={faGauge} className="size-5 shrink-0" aria-hidden />
          <AlertContent>
            <AlertTitle>You haven&rsquo;t said what makes a {noun} worth chasing</AlertTitle>
            <AlertDescription>
              Scoring puts a number on every record from rules you write — how much they have spent,
              how recently they replied, whatever matters to you — so the list can be sorted by who
              to call first. Until you set it up, everybody sits at zero.
            </AlertDescription>
          </AlertContent>
        </Alert>
        <Button
          color="module"
          size="sm"
          className="self-start"
          onClick={(event) => {
            ctx.open('crm.scoring', { objectKey }, { target: event.shiftKey ? 'beside' : 'tab' });
          }}
        >
          Set up scoring
        </Button>
      </FormSection>
    );
  }

  const max = model.maxScore;
  const band = scoreBand(score, max);
  const reasons = breakdown?.reasons ?? [];
  const decayed = breakdown?.decayed ?? 0;

  // ══════════════════════════════════════════════════════════════════════════
  // THE STORED NUMBER AND THE LIVE ONE CAN DISAGREE FOR TWO DIFFERENT REASONS
  // ══════════════════════════════════════════════════════════════════════════
  //
  // Saying nothing about a mismatch is how somebody decides the score is made up.
  // But saying the WRONG thing about it is worse, and this panel did: it reported
  // every difference as "the rules have changed since this was last worked out",
  // which is a plain falsehood the moment anybody uses the button directly above
  // it. A hand adjustment sits on top of the rules and leaves them untouched, so
  // the two numbers differ BY DESIGN and permanently — "your rules would put
  // this at 50" is true, and "the rules have changed" is not.
  //
  // The two are now told apart by the OFFSET rather than by the newest history
  // row. `scoreOffset` is the standing adjustment itself, so it is still right
  // after a hundred rule re-scores have pushed the manual event off the end of
  // the list; `history[0].source` was only ever a proxy for it, and a proxy that
  // expires. Both can be true at once, and the adjustment is the one to explain:
  // a stale rules total is fixed by re-scoring, which the offset survives.
  const live = breakdown?.score;
  const differs = live !== undefined && live !== score;
  const movedByHand = scoreOffset !== 0;

  return (
    <FormSection
      title="Score"
      description={`What your “${model.name}” rules make of this ${noun}, and why.`}
      action={
        <Button
          variant="ghost"
          color="neutral"
          size="sm"
          onClick={(event) => {
            ctx.open('crm.scoring', { objectKey }, { target: event.shiftKey ? 'beside' : 'tab' });
          }}
        >
          Edit the rules
        </Button>
      }
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-module text-5xl font-semibold tabular-nums">{score}</span>
        <Text as="span" className="text-base">
          out of {max}
        </Text>
        {score > 0 ? (
          <Badge color={band.color} variant="soft">
            {band.label}
          </Badge>
        ) : null}
        <Text as="span" className="ml-auto text-sm">
          {scoredWhen(scoredAt)}
        </Text>
      </div>

      {differs ? (
        movedByHand ? (
          // Nothing is broken here, so it is not a warning — somebody decided
          // this record was worth more than the rules could see, which is what
          // the button is for. It used to warn that a re-score would undo it,
          // which was true and awful: the platform's one manual lever was
          // temporary, and an owner who pressed "Re-score everyone" watched
          // their judgement disappear. The adjustment is now kept and added to
          // every future rules total, so this says what it does instead.
          <Alert color="info">
            <AlertContent>
              <AlertTitle>
                Someone moved this by hand, {scoreOffset > 0 ? 'up' : 'down'}{' '}
                {Math.abs(scoreOffset)}
              </AlertTitle>
              <AlertDescription>
                Your rules on their own would put this {noun} at {live}. The change below says who
                moved it and why, and it sticks — re-scoring everyone keeps the{' '}
                {scoreOffset > 0 ? '+' : '−'}
                {Math.abs(scoreOffset)} and only recalculates the rest. If it is something you want
                counted for everybody rather than just this {noun}, it belongs in the rules.
              </AlertDescription>
            </AlertContent>
          </Alert>
        ) : (
          <Alert color="warning">
            <AlertContent>
              <AlertTitle>Your rules would put this at {live} today</AlertTitle>
              <AlertDescription>
                The rules have changed since this was last worked out. Open scoring and press
                &ldquo;Re-score everyone&rdquo; to bring every record up to date at once.
              </AlertDescription>
            </AlertContent>
          </Alert>
        )
      ) : null}

      {reasons.length === 0 && decayed === 0 ? (
        <Text className="text-base">
          None of your rules fit this {noun}, so nothing has added to their score. If that is true
          of everybody you look at, the rules are asking about details your records do not hold.
        </Text>
      ) : (
        <ul className="divide-base-300 flex flex-col divide-y">
          {reasons.map((reason, i) => (
            <li key={i} className="flex items-center justify-between gap-3 py-1.5">
              <span className="min-w-0 truncate text-base">{reason.label}</span>
              <Badge color={reason.points >= 0 ? 'success' : 'warning'} variant="soft" size="sm">
                {reason.points >= 0 ? '+' : ''}
                {reason.points}
              </Badge>
            </li>
          ))}
          {decayed > 0 ? (
            <li className="flex items-center justify-between gap-3 py-1.5">
              <span className="min-w-0 truncate text-base">Has gone quiet</span>
              <Badge color="warning" variant="soft" size="sm">
                &minus;{decayed}
              </Badge>
            </li>
          ) : null}
        </ul>
      )}

      <AdjustScore objectKey={objectKey} recordId={recordId} />

      {history.length > 0 ? (
        <div className="flex flex-col gap-1">
          <Text className="font-medium">How it got here</Text>
          <ul className="divide-base-300 flex flex-col divide-y">
            {history.map((event) => (
              <HistoryRow key={event.id} event={event} actorName={actorName(event.actorId)} />
            ))}
          </ul>
        </div>
      ) : null}
    </FormSection>
  );
}
