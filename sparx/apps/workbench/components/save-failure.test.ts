import { describe, expect, it } from 'vitest';
import { messageBeyondTitle } from './save-failure-words';

/**
 * THE SAME SENTENCE, TWICE, NAMING NOTHING.
 *
 * Creating an Event with "Starts" empty answered:
 *
 *     Could not create this
 *     Could not create this. Nothing was saved.
 *
 * The title is the surface's own words and the fallback message begins with
 * them, so the refusal reads itself out twice and the only new words in it come
 * last. 55 surfaces pass a title and a fallback through this component, so the
 * repeat is dropped here rather than at every call site.
 */
describe('messageBeyondTitle', () => {
  it('drops the title where the message opens with it', () => {
    expect(
      messageBeyondTitle('Could not create this', 'Could not create this. Nothing was saved.')
    ).toBe('Nothing was saved.');
  });

  it('renders nothing when the message IS the title', () => {
    expect(messageBeyondTitle('Could not save that', 'Could not save that')).toBeNull();
    expect(messageBeyondTitle('Could not save that', 'Could not save that.')).toBeNull();
  });

  it('keeps a message that says something else entirely', () => {
    // The server's own sentence is the whole point of showing a description.
    const server = 'Not enough stock to reserve. 2 left, 5 asked for.';
    expect(messageBeyondTitle('Could not save this order', server)).toBe(server);
  });

  it('keeps a message that merely starts with a similar word', () => {
    expect(messageBeyondTitle('Could not save', 'Could not be reached.')).toBe(
      'Could not be reached.'
    );
  });

  it('does not care about casing or punctuation in the repeat', () => {
    expect(
      messageBeyondTitle('Could not create this', 'COULD NOT CREATE THIS — nothing was saved.')
    ).toBe('nothing was saved.');
  });

  it('keeps the remainder punctuation and casing it was written with', () => {
    expect(
      messageBeyondTitle('That key could not be used', "That key could not be used: it's expired.")
    ).toBe("it's expired.");
  });

  it('survives an empty title, which is not this component to fix', () => {
    expect(messageBeyondTitle('', 'Something went wrong.')).toBe('Something went wrong.');
    expect(messageBeyondTitle('', '   ')).toBeNull();
  });

  it('does not mistake a longer title for a prefix of a shorter message', () => {
    expect(messageBeyondTitle('Could not create this thing', 'Could not create this.')).toBe(
      'Could not create this.'
    );
  });
});
