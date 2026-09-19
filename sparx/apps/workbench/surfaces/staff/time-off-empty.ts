// WHAT AN EMPTY TIME-OFF QUEUE MEANS.
//
// The queue opens on "Waiting on you", and when that view was empty it said:
//
//     Nothing waiting on you
//     Every request has been answered. Switch to Everything to see what has
//     already been decided.
//
// There is exactly ONE time-off request on the whole platform. Every other
// business has been told every request has been answered, and sent to a second
// empty screen to look at decisions nobody ever made.
//
// "All answered" and "nobody has ever asked" are the same empty list and
// opposite facts, and only a total across the whole queue can tell them apart —
// which is why the endpoint now sends one ([[feedback_never_present_absence_as_measurement]]).
//
// Counts get their own branch rather than a ternary inside a sentence: a
// plural-only phrase reads fine in source and only breaks on screen.

export interface TimeOffEmpty {
  title: string;
  detail: string;
}

/** `total` is every request on record, whatever `filter` is showing. */
export function timeOffEmptyWords(filter: string, total: number): TimeOffEmpty {
  if (total <= 0) {
    return {
      title: 'No time off asked for yet',
      detail:
        'Nobody has asked for time off, and none has been logged for anyone. When someone asks, ' +
        'or you log it for them, it appears here, and approved dates show on the schedule.',
    };
  }

  if (filter === 'requested') {
    if (total === 1) {
      return {
        title: 'Nothing waiting on you',
        detail:
          'The one request on record has been answered. Switch to Everything to see what was decided.',
      };
    }
    return {
      title: 'Nothing waiting on you',
      detail:
        `All ${String(total)} requests on record have been answered. ` +
        'Switch to Everything to see what was decided.',
    };
  }

  if (filter === 'approved') {
    if (total === 1) {
      return {
        title: 'Nothing approved',
        detail:
          'The one request on record was not approved. Switch to Everything to see what happened to it.',
      };
    }
    return {
      title: 'Nothing approved',
      detail:
        `None of the ${String(total)} requests on record were approved. ` +
        'Switch to Everything to see what happened to them.',
    };
  }

  // Everything, and still nothing — only reachable if the list and the count
  // disagree, so it says what it knows rather than guessing at a reason.
  return {
    title: 'Nothing to show',
    detail: 'No request matches what is selected. Try Everything.',
  };
}
