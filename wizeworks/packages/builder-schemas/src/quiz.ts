// Quiz + calculator scoring (docs/151 §7, docs/152 C3).
//
// ── WHY THE WEIGHTS ARE SERVER-ONLY ──────────────────────────────────────────
//
// A quiz that decides somebody is a strong lead is making a claim the sales side
// will act on, so the arithmetic cannot live anywhere the person being scored can
// edit it. The weights ride in `FormDefinition.config` — the same server-only bag
// that already holds routing, and for the same reason the recipient addresses are
// there rather than in the published tree. The browser sends answers; the server
// decides what they are worth.
//
// ── AND WHY THE SCORE IS A REAL CRM SCORE ────────────────────────────────────
//
// The outcome is applied through the existing CRM scoring model, never as a
// number of its own. A quiz that concludes somebody is a certain kind of buyer
// and leaves no trace the sales side can see is a toy, and `explain_crm_score`
// already exists to make the reasoning inspectable — so the quiz shows up there
// beside every other reason the score is what it is.
//
// A calculator is the same machine with a multiplier on the end: "how much could
// you save" is a weighted sum of answers times a rate. It is deliberately NOT an
// expression language — an author-supplied formula would be a parser and an
// evaluator running on submitted input, which is a great deal of risk to buy a
// feature nobody asked for.

/** What one answer is worth. Absent ⇒ zero, so a new option added to a question
 *  scores nothing until somebody says what it is worth. */
export type AnswerWeights = Record<string, Record<string, number>>;

/** What the visitor is told, once their answers are added up. */
export interface QuizOutcome {
  /** The lowest score that lands here. Bands are matched highest-first. */
  minScore: number;
  headline: string;
  body: string;
}

/** Turns points into the thing a calculator actually reports. */
export interface QuizMultiplier {
  /** What one point is worth. */
  perPoint: number;
  /** Rendered before the number — a currency symbol, or ''. */
  prefix: string;
  /** Rendered after it — ' hours a week', ' a year', ''. */
  suffix: string;
}

export interface QuizScoring {
  /** field name → answer value → points. */
  weights: AnswerWeights;
  /** Bands, in any order — matching sorts them. */
  outcomes: QuizOutcome[];
  /** Present ⇒ this is a calculator and the result is a quantity. */
  multiplier: QuizMultiplier | null;
  /** Add the points to the person's CRM score. Off ⇒ the quiz still tells the
   *  visitor their result and still records the answers, it just does not make a
   *  claim about them in the CRM. */
  scoreContact: boolean;
  /** What the score event says in the business's own words. */
  reason: string;
}

export const NO_QUIZ_SCORING: QuizScoring = {
  weights: {},
  outcomes: [],
  multiplier: null,
  scoreContact: false,
  reason: '',
};

const asNum = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;
const asStr = (v: unknown, fallback: string): string => (typeof v === 'string' ? v : fallback);

/** Read a stored scoring config back, tolerantly. A form saved before quizzes
 *  existed, or one whose config drifted, must degrade to "not a quiz" rather
 *  than throwing on a live submit. */
export function readQuizScoring(raw: unknown): QuizScoring {
  if (!raw || typeof raw !== 'object') return NO_QUIZ_SCORING;
  const r = raw as Record<string, unknown>;

  const weights: AnswerWeights = {};
  if (r.weights && typeof r.weights === 'object') {
    for (const [field, answers] of Object.entries(r.weights as Record<string, unknown>)) {
      if (!answers || typeof answers !== 'object') continue;
      const row: Record<string, number> = {};
      for (const [answer, points] of Object.entries(answers as Record<string, unknown>)) {
        if (typeof points === 'number' && Number.isFinite(points)) row[answer] = points;
      }
      weights[field] = row;
    }
  }

  const outcomes: QuizOutcome[] = Array.isArray(r.outcomes)
    ? r.outcomes
        .filter((o): o is Record<string, unknown> => !!o && typeof o === 'object')
        .map((o) => ({
          minScore: asNum(o.minScore, 0),
          headline: asStr(o.headline, ''),
          body: asStr(o.body, ''),
        }))
        .filter((o) => o.headline !== '')
    : [];

  const m = r.multiplier;
  const multiplier =
    m && typeof m === 'object'
      ? {
          perPoint: asNum((m as Record<string, unknown>).perPoint, 0),
          prefix: asStr((m as Record<string, unknown>).prefix, ''),
          suffix: asStr((m as Record<string, unknown>).suffix, ''),
        }
      : null;

  return {
    weights,
    outcomes,
    multiplier: multiplier && multiplier.perPoint !== 0 ? multiplier : null,
    scoreContact: r.scoreContact === true,
    reason: asStr(r.reason, ''),
  };
}

/** Does this form actually score anything? A config with no weights is a plain
 *  form wearing a quiz's clothes, and must behave as a plain form. */
export function isQuiz(scoring: QuizScoring): boolean {
  return Object.keys(scoring.weights).length > 0;
}

export interface QuizResult {
  /** Total points. Never null — an unanswered quiz scores 0, which is a real
   *  answer about the person, not a missing measurement. */
  points: number;
  /** The band their score landed in, or null when the author defined none. */
  outcome: QuizOutcome | null;
  /** points × perPoint, for a calculator. Null when this is not one. */
  amount: number | null;
  /** The rendered quantity ("$1,240 a year"), or null. */
  amountLabel: string | null;
}

/**
 * Add up what somebody answered.
 *
 * A multi-value answer (a checkbox group arrives as "a, b") scores every option
 * it names, because ticking three boxes that each mean something should be worth
 * three things — collapsing it to one would quietly under-score the most engaged
 * respondent in the set.
 */
export function scoreAnswers(scoring: QuizScoring, values: Record<string, string>): QuizResult {
  let points = 0;
  for (const [field, answers] of Object.entries(scoring.weights)) {
    const given = values[field];
    if (!given) continue;
    for (const one of given.split(',').map((s) => s.trim())) {
      const weight = answers[one];
      if (typeof weight === 'number') points += weight;
    }
  }

  const outcome =
    [...scoring.outcomes]
      .sort((a, b) => b.minScore - a.minScore)
      .find((o) => points >= o.minScore) ?? null;

  const amount = scoring.multiplier ? points * scoring.multiplier.perPoint : null;
  const amountLabel =
    amount === null || !scoring.multiplier
      ? null
      : `${scoring.multiplier.prefix}${new Intl.NumberFormat().format(
          Math.round(amount)
        )}${scoring.multiplier.suffix}`;

  return { points, outcome, amount, amountLabel };
}
