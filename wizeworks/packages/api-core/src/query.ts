// Zod pieces for parsing a QUERY STRING, where every value is a string.
//
// This file exists because the same two mistakes have shipped repeatedly, and
// both are invisible until someone actually calls the endpoint:
//
//   1. `z.int()` / `z.number()` in a query schema REJECTS "50", so the route
//      answers 422 for every caller that sends the parameter at all. A
//      `.default()` hides it in testing — omit the param and it passes, send it
//      and it never works. `GET /v1/finance/expenses` shipped in exactly that
//      state: the workbench always sent `limit`, so Spending was broken for
//      every tenant from the day it launched.
//
//   2. `z.coerce.boolean()` is `Boolean(value)`, and `Boolean('false')` is TRUE.
//      So `?include_archived=false` INCLUDES archived records — the opposite of
//      what was asked, with no error anywhere. Three separate route files had
//      already written a comment warning about this and hand-rolled around it;
//      this is that workaround, in one place.
//
// Use `queryInt` and `queryBool` for anything read out of `request.query`.
// A REQUEST BODY is real JSON and needs neither — `z.int()` and `z.boolean()`
// are correct there, and using these would only widen what the body accepts.

import { z } from 'zod';

/**
 * A boolean from a query string: `true`/`false` as a string, or a real boolean
 * for a programmatic caller. Anything else is a validation error rather than a
 * silent truthy — `?paid=yes` is a caller bug worth reporting, not a `true`.
 */
export const queryBool = z
  .union([z.boolean(), z.enum(['true', 'false'])])
  .transform((value) => value === true || value === 'true');

/**
 * An integer from a query string. Coerces, so `"50"` and `50` both work.
 * Chain the bounds yourself: `queryInt.min(1).max(200).default(50)`.
 */
export const queryInt = z.coerce.number().int();
