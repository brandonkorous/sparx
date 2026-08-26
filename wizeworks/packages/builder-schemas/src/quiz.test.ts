import { describe, expect, it } from 'vitest';
import { NO_QUIZ_SCORING, isQuiz, readQuizScoring, scoreAnswers, type QuizScoring } from './quiz';

const FIT_QUIZ: QuizScoring = {
  weights: {
    team_size: { '1-5': 0, '6-20': 10, '21+': 25 },
    urgency: { browsing: 0, 'this quarter': 15, 'this month': 30 },
    channels: { shop: 5, wholesale: 10, phone: 5 },
  },
  outcomes: [
    { minScore: 0, headline: 'Have a look around', body: 'Start with the free plan.' },
    { minScore: 30, headline: 'Worth a conversation', body: 'Book a call.' },
    { minScore: 55, headline: 'We should talk today', body: 'Here is a calendar link.' },
  ],
  multiplier: null,
  scoreContact: true,
  reason: 'Answered the fit quiz',
};

describe('scoreAnswers — adding up what they said', () => {
  it('adds the weight of each answer', () => {
    const r = scoreAnswers(FIT_QUIZ, { team_size: '6-20', urgency: 'this month' });
    expect(r.points).toBe(40);
  });

  it('scores every option of a multi-select, not just the first', () => {
    // Ticking three boxes that each mean something is worth three things;
    // collapsing it would under-score the most engaged respondent in the set.
    const r = scoreAnswers(FIT_QUIZ, { channels: 'shop, wholesale, phone' });
    expect(r.points).toBe(20);
  });

  it('scores an unanswered question as nothing, not as a gap', () => {
    const r = scoreAnswers(FIT_QUIZ, {});
    expect(r.points).toBe(0);
    // Zero is a real answer about this person, so it still lands in a band.
    expect(r.outcome?.headline).toBe('Have a look around');
  });

  it('ignores an answer nobody said the value of', () => {
    // A newly added option scores nothing until the author weights it, rather
    // than defaulting to something and quietly inventing a claim.
    const r = scoreAnswers(FIT_QUIZ, { team_size: 'a partnership' });
    expect(r.points).toBe(0);
  });

  it('ignores a field that is not part of the scoring', () => {
    const r = scoreAnswers(FIT_QUIZ, { email: 'jordan@example.com', urgency: 'this quarter' });
    expect(r.points).toBe(15);
  });
});

describe('scoreAnswers — which band they land in', () => {
  it('takes the highest band the score reaches', () => {
    expect(
      scoreAnswers(FIT_QUIZ, { team_size: '21+', urgency: 'this month' }).outcome?.headline
    ).toBe('We should talk today');
  });

  it('matches the boundary itself', () => {
    expect(scoreAnswers(FIT_QUIZ, { urgency: 'this month' }).outcome?.minScore).toBe(30);
  });

  it('returns no band when the author defined none', () => {
    const r = scoreAnswers({ ...FIT_QUIZ, outcomes: [] }, { urgency: 'this month' });
    expect(r.outcome).toBeNull();
    // The score is still real — the tenant gets it even with nothing to show.
    expect(r.points).toBe(30);
  });

  it('is not confused by bands declared out of order', () => {
    const shuffled = { ...FIT_QUIZ, outcomes: [...FIT_QUIZ.outcomes].reverse() };
    // 25 + 15 = 40, which is the middle band whichever order they were declared.
    expect(
      scoreAnswers(shuffled, { team_size: '21+', urgency: 'this quarter' }).outcome?.headline
    ).toBe('Worth a conversation');
  });
});

describe('scoreAnswers — the calculator', () => {
  const SAVINGS: QuizScoring = {
    weights: { orders: { '<50': 50, '50-500': 500, '500+': 2000 } },
    outcomes: [],
    multiplier: { perPoint: 1.4, prefix: '$', suffix: ' a year' },
    scoreContact: false,
    reason: 'Used the savings calculator',
  };

  it('turns points into the quantity it reports', () => {
    const r = scoreAnswers(SAVINGS, { orders: '50-500' });
    expect(r.amount).toBe(700);
    expect(r.amountLabel).toBe('$700 a year');
  });

  it('groups a large number the way a person reads it', () => {
    expect(scoreAnswers(SAVINGS, { orders: '500+' }).amountLabel).toBe('$2,800 a year');
  });

  it('reports nothing rather than zero when it is not a calculator', () => {
    const r = scoreAnswers(FIT_QUIZ, { urgency: 'this month' });
    expect(r.amount).toBeNull();
    expect(r.amountLabel).toBeNull();
  });
});

describe('readQuizScoring — a config that drifted must not break a live submit', () => {
  it('reads a well-formed config', () => {
    const cfg = readQuizScoring({
      weights: { a: { yes: 5 } },
      outcomes: [{ minScore: 0, headline: 'Hello', body: 'There' }],
      scoreContact: true,
      reason: 'Took the quiz',
    });
    expect(cfg.weights).toEqual({ a: { yes: 5 } });
    expect(cfg.scoreContact).toBe(true);
  });

  it('degrades to not-a-quiz on anything unreadable', () => {
    expect(readQuizScoring(null)).toEqual(NO_QUIZ_SCORING);
    expect(readQuizScoring('quiz')).toEqual(NO_QUIZ_SCORING);
    expect(isQuiz(readQuizScoring({}))).toBe(false);
  });

  it('drops a weight that is not a number', () => {
    const cfg = readQuizScoring({ weights: { a: { yes: 'lots', no: 2 } } });
    expect(cfg.weights.a).toEqual({ no: 2 });
  });

  it('drops an outcome with no headline, which has nothing to show anybody', () => {
    const cfg = readQuizScoring({
      outcomes: [{ minScore: 10 }, { minScore: 0, headline: 'Fine', body: '' }],
    });
    expect(cfg.outcomes).toHaveLength(1);
  });

  it('treats a zero-rate multiplier as no multiplier', () => {
    // Otherwise every calculator whose rate was never filled in confidently
    // reports "$0", which reads as a measurement rather than a blank field.
    expect(
      readQuizScoring({ multiplier: { perPoint: 0, prefix: '$', suffix: '' } }).multiplier
    ).toBeNull();
  });

  it('never treats a missing scoreContact as consent to score somebody', () => {
    expect(readQuizScoring({ weights: { a: { yes: 1 } } }).scoreContact).toBe(false);
  });
});
