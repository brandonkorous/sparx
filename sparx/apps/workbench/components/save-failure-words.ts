// The part of a refusal's message that is not just its title again.
//
// ---------------------------------------------------------------------------
// The bug this exists for
// ---------------------------------------------------------------------------
//
// Creating an Event with "Starts" left empty answered:
//
//     Could not create this
//     Could not create this. Nothing was saved.
//
// `<SaveFailure>` takes a title in the surface's own words and a message, and a
// fallback message is usually written to stand alone — so it opens with the
// title's own words and the refusal reads itself out twice. The only new words
// in it come last, after the repeat.
//
// 55 surfaces pass a title and a fallback through that component, so the repeat
// is dropped in ONE place rather than by rewording 55 strings, which is also
// the only version that holds for the fallback written next month.

/**
 * The message with a leading repeat of the title removed.
 *
 * Matched on letters alone, so a trailing full stop, a dash or a capital cannot
 * hide the repeat. The remainder is taken from the ORIGINAL string, so it keeps
 * its own punctuation and casing.
 *
 * Returns `null` when nothing is left, which is the caller's signal to render
 * no description at all. A message that says something else entirely comes back
 * whole: the server's own sentence is the reason a description exists.
 */
export function messageBeyondTitle(title: string, message: string): string | null {
  const head = letters(title);
  if (head === '') return message.trim() === '' ? null : message;
  const whole = letters(message);
  if (whole === head) return null;
  if (!whole.startsWith(`${head} `)) return message;
  // Walk the same number of letters through the original. Counted WITHOUT the
  // spaces `letters` puts in: those spaces stand for runs of punctuation that
  // may be any length in the original, so counting them walks the wrong
  // distance and cuts into the remainder.
  const want = head.replace(/ /g, '').length;
  let seen = 0;
  let cut = 0;
  for (let i = 0; i < message.length && seen < want; i += 1) {
    if (/[a-z0-9]/i.test(message[i] ?? '')) seen += 1;
    cut = i + 1;
  }
  const tail = message
    .slice(cut)
    .replace(/^[^A-Za-z0-9]+/, '')
    .trim();
  return tail === '' ? null : tail;
}

function letters(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
