// ONE NAME FOR ONE THING, IN ONE PLACE.
//
// Every kind of content and every vocabulary carries a short lowercase code —
// `blog_post`, `blog_category` — that joins it to the entries that use it. A shop
// owner never types one; it is filled in from the name. But it shows on four
// screens under Content, and until this module those four screens called it
// three different things:
//
//   Kinds of content, the list      "Key"
//   Kinds of content, the editor    "Id"          ← one click from the list
//   Tags and topics, the list       "Reference"
//   Tags and topics, the editor     "Reference"
//
// Issue 385 settled the twin pane on "Reference" and explained it. Issue 389
// found the other two, recorded them as still open, and did not change them
// because picking one word is a decision about the whole section rather than a
// rename in passing. The decision is "Reference", because it is the only one of
// the three that says what the thing is FOR rather than what a database calls it.
//
// The word now lives here, imported by all four, so the next screen that needs it
// cannot invent a fourth name without deliberately not importing this.

/** What the code is called, wherever a person reads it. */
export const REFERENCE_LABEL = 'Reference';

/** What it is, in one sentence. Used as the list column's tooltip and as the
 *  help under the field, so the same fact reads the same in both places. */
export const REFERENCE_HELP =
  'The code that connects this to your content. You never have to type it.';

/** The same fact once the code is fixed and the field is read-only. */
export const REFERENCE_HELP_FIXED =
  'The code that connects this to your content. It cannot be changed.';
