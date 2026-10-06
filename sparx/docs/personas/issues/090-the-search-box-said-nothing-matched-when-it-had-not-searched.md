# 090 — The search box said nothing matched when it had not searched

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 5 (searching while the API restarted)
**Surface:** workbench › Search everything (both consoles)
**Filed:** 2026-10-06
**Fixed:** 2026-10-06
**Confirmed by:** P01 on screen, 2026-10-06
**Blocked on:** —

## What happened

Doty typed "O-0000" while the API was restarting. Both searches came back 503. The box said, in the list: "Nothing matches that. Try a different word." and under it: "Nothing in your records matches “O-0000”." Gillett has fifteen orders that match.

## What should have happened

A search that did not answer is not an answer. The box says it could not search, and offers to try again.

## How to reproduce

1. Search everything, type "O-0000" while the API is down or restarting.
2. Before the fix: the two sentences above. Every time a search request fails.

## Why it matters

"Nothing in your records matches" is a claim about her business. Made on no evidence, it tells her a customer or an order does not exist. She retypes, gives up, or creates a duplicate. In production this is any short outage, a timeout, or the search engine being briefly unreachable.

## Where it lives

`useRecordSearch` in `lib/api/search.ts` (both consoles) read `data ?? []` and never looked at whether the request failed, so a failure became zero rows. `recordSearchLine` and `LauncherEmpty` then described zero rows.

## The fix

Both consoles, the same edit:

- `useRecordSearch` reports `failed` (a backend errored and gave nothing back) and `retry`.
- `recordSearchLine` checks it before any count: "The search could not reach your records just now, so this is not an answer. Try again in a moment." When one half answered: "5 records came back, but part of the search did not answer, so there may be more. Try again in a moment."
- The empty list says "No screen matches that, and your records could not be searched just now."
- A **Try again** button beside the sentence asks both searches again.
- **A search too long to send is its own message.** Forcing the failure on screen (below) found a second cause behind the same outcome: a 24,000-character paste made a request the server refused every time, so "try again in a moment" could never work. Past 1,000 characters (`SEARCH_MOST_CHARS`) the box does not send it and says "That is too long to search. Try a few words from it." The list above it speaks only for the screens: "No screen matches that."

Tests: `components/launcher-search-words.test.ts` in both consoles. "a search that did not answer": the old sentence reddens 3 of 4 in each (the fourth checks that "Looking through your records…" still comes first while it retries). "a search too long to send": removing the length branch reddens 1 of 2 in each (the other checks a search of exactly 1,000 characters still goes). Console parity passes.

## Confirmed by

On screen, 2026-10-06, as Doty, without stopping anything: a 24,007-character search ("O-0000 " and "Wasatch " three thousand times) pasted into the box, which the server refused. The list read "No screen matches that, and your records could not be searched just now." and the note "The search could not reach your records just now, so this is not an answer. Try again in a moment." beside a Try again button. With the length limit in place, the same paste reads "No screen matches that." over "That is too long to search. Try a few words from it.", and sends nothing. The normal path was seen after both changes ("O-0000" and "Wasatch" as in [089] and [087]).

Piggles, the same day, as Devi (Juniper Row): the 21,000-character paste reads "No screen matches that." over "That is too long to search. Try a few words from it." Both messages read clearly in light mode too.

Not seen on screen: pressing **Try again** after a real failure. While the API restarts the whole console shows "Reconnecting" instead, so the search box cannot be opened then, and a dropped request cannot be faked from outside because the console holds its own copy of `fetch`. The button asks both searches again through React Query's `refetch`; the sentence above it is tested.

## Rating effect

—
