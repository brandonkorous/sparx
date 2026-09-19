import { describe, expect, it } from 'vitest';
import { explainRunError, showsReported } from './run-errors';

// The string a boutique owner actually read, 35 times across the platform.
const UNREGISTERED = 'no executor registered for action "email.send_campaign"';

describe('an error the engine raises about itself', () => {
  it('says plainly that it is not hers to fix', () => {
    const said = explainRunError(UNREGISTERED, 'Send a marketing email');
    expect(said.yours).toBe(false);
    expect(said.detail).toContain('fault on our side');
    expect(said.detail).toContain('Nothing you change in this rule will fix it');
  });

  it('names the step the way the console names it, not the way the engine does', () => {
    const said = explainRunError(UNREGISTERED, 'Send a marketing email');
    expect(said.headline).toContain('Send a marketing email');
    expect(said.headline).not.toContain('email.send_campaign');
    expect(said.headline).not.toContain('executor');
    expect(said.detail).not.toContain('executor');
  });

  it('still works when the caller cannot say which step failed', () => {
    // The run-level banner has the run's error and no step to hang it on when
    // the steps failed to record. It must not print an empty pair of quotes.
    const said = explainRunError(UNREGISTERED, null);
    expect(said.headline).toBe('We could not carry out one of the steps in this rule.');
    expect(said.headline).not.toContain('“”');
    expect(said.yours).toBe(false);
  });

  it('keeps the engine wording so she can quote it to us', () => {
    const said = explainRunError(UNREGISTERED, 'Send a marketing email');
    expect(said.reported).toBe(UNREGISTERED);
    expect(showsReported(said)).toBe(true);
  });
});

describe('an error an action raises about its own work', () => {
  it('drops the action id and keeps the sentence', () => {
    const said = explainRunError(
      'crm.create_task: this step could not work out who to give the task to.',
      'Create a task'
    );
    expect(said.headline).toContain('Create a task');
    expect(said.detail).toBe('This step could not work out who to give the task to.');
    expect(said.detail).not.toContain('crm.create_task');
    expect(said.yours).toBe(true);
  });

  it('capitalizes the remainder, which was written to follow a colon', () => {
    const said = explainRunError('crm.rotate_owner: nobody to assign to.', 'Rotate the owner');
    expect(said.detail).toBe('Nobody to assign to.');
  });

  it('reads a multi-line message whole', () => {
    // `social.post` builds its message across two concatenated lines.
    const said = explainRunError('social.post: the post came out empty.\nWrite one.', 'Post');
    expect(said.detail).toBe('The post came out empty.\nWrite one.');
  });

  it('does not print the same sentence twice', () => {
    // The banner AND the step card both showed the raw string. Once the prefix
    // is gone the translated line carries everything, so the labeled copy of
    // the engine wording is still worth showing; when NOTHING was translated it
    // is not.
    const translated = explainRunError('crm.create_task: nobody to assign to.', 'Create a task');
    expect(showsReported(translated)).toBe(true);

    const untouched = explainRunError('Connection reset by the other end.', 'Send a webhook');
    expect(showsReported(untouched)).toBe(false);
    expect(untouched.detail).toBe('Connection reset by the other end.');
  });
});

describe('a colon that is not an action id', () => {
  it('leaves an ordinary sentence alone', () => {
    // "Stopped: nothing matched" has a colon and is not a prefix. Eating the
    // first half would delete the half that says what happened.
    const said = explainRunError('Stopped: nothing matched the condition.', 'Check the order');
    expect(said.detail).toBe('Stopped: nothing matched the condition.');
  });

  it('needs a dot in the prefix, because every action id has one', () => {
    const said = explainRunError('warning: the price looked wrong.', 'Update the price');
    expect(said.detail).toBe('Warning: the price looked wrong.');
  });

  it('leaves a prefix with nothing after it alone', () => {
    const said = explainRunError('crm.create_task:', 'Create a task');
    expect(said.detail).toBe('Crm.create_task:');
    expect(said.reported).toBe('crm.create_task:');
  });
});

describe('when nothing names the step', () => {
  it('says the run could not finish rather than inventing a step', () => {
    const said = explainRunError('Connection reset by the other end.', null);
    expect(said.headline).toBe('This run could not finish.');
    expect(said.yours).toBe(true);
  });

  it('treats an empty action name as no name', () => {
    const said = explainRunError('Connection reset by the other end.', '   ');
    expect(said.headline).toBe('This run could not finish.');
  });
});
