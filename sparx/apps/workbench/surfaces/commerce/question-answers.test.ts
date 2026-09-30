import { describe, expect, it } from 'vitest';
import { answerBoxPrompt, answerState, shownWithoutAnswerNote } from './question-answers';

// What this file is here to stop: a questions table that reports where every
// question SITS and never whether anybody replied to it, on the one screen built
// to work across every product. A shown question with no answer is a customer's
// question on her product page with silence under it, and once shown it leaves
// the pending backlog for good (issue 734).

describe('what a row says about its answers', () => {
  it('names the unanswered one and colors only that one', () => {
    // The whole point of the column. If this row read the same as the others,
    // the column would be decoration.
    expect(answerState(0)).toEqual({ label: 'No answer yet', tone: 'info' });
  });

  it('leaves the settled rows quiet', () => {
    expect(answerState(1)).toEqual({ label: 'Answered', tone: null });
    expect(answerState(3)).toEqual({ label: '3 answers', tone: null });
  });

  it('treats a missing count as unanswered rather than as answered', () => {
    // An older row, or a server that stopped sending the field, must fall to the
    // side that asks her to look — never to "Answered", which would be the
    // console telling her a job is done that nobody did.
    expect(answerState(-1).label).toBe('No answer yet');
  });
});

describe('what she is told at the moment she shows one', () => {
  it('says nothing when every question she showed already had an answer', () => {
    expect(shownWithoutAnswerNote(0)).toBeUndefined();
  });

  it('counts them in her own words', () => {
    expect(shownWithoutAnswerNote(1)).toContain('no answer yet');
    expect(shownWithoutAnswerNote(4)).toContain('4 of them');
  });
});

describe('what the answer box promises', () => {
  it('does not tell her to show a question that is already shown', () => {
    // The sentence the "No answer yet" view hands her most often. It used to
    // name a step she had taken and imply her answer stayed private until she
    // took it again. [[feedback_a_promise_in_copy_is_a_contract]]
    const words = answerBoxPrompt('published');
    expect(words).toContain('already on');
    expect(words).not.toContain('once you show it');
  });

  it('does not promise a page a hidden question is not on', () => {
    const words = answerBoxPrompt('rejected');
    expect(words).toContain('hidden');
    expect(words).not.toContain('once you show it');
  });

  it('keeps the original sentence for a question still waiting', () => {
    expect(answerBoxPrompt('pending')).toContain('once you show it');
    // A status this console has never heard of is treated as still open, the
    // same rule moderation-decisions.ts follows for the buttons.
    expect(answerBoxPrompt('quarantined')).toContain('once you show it');
  });
});
