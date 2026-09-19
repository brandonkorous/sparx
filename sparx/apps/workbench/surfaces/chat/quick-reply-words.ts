// WHICH OF HER BUSINESSES A SAVED REPLY BELONGS TO, SAID ON THE ROW.
//
// A quick reply is offered on ONE site or on every site the tenant runs, and the
// pane's compose form has a control for exactly that choice. The list then showed
// the name, the shortcut and the message — and nothing about the choice. The
// service's own note explains the design at length:
//
//     BOTH tiers, not most-specific-wins … a site-specific reply ADDS to the
//     generic ones instead of replacing them.
//
// So the list is deliberately a mix of the two, and gave a person no way to tell
// them apart. On a tenant running seven websites that reads as replies appearing
// and disappearing as the operator changes site, with nothing on screen saying
// why: a value somebody picks has to be read back in the words they picked it in.
//
// The delete is the sharp end. "Your team will no longer be able to send this
// saved reply" is true of a reply for one site and badly incomplete for a shared
// one, which goes from all seven at once. Name the target AND the loss.
//
// Every reader takes the SITE COUNT, because a tenant with one site must never
// read a sentence about sites it does not have — the same rule the shared
// SiteScopeField states and this pane had not applied.

/** The parts of a saved reply these sentences read. */
export interface ScopedReply {
  title: string;
  /** One site's id, or null for every site the tenant runs. */
  propertyId: string | null;
}

/** True when a reply is offered on every site rather than just this one. */
export function isSharedReply(reply: ScopedReply): boolean {
  return reply.propertyId === null;
}

/**
 * The note beside a reply's name in the list.
 *
 * Null for a tenant with one site: there is no second site for the answer to be
 * about. Otherwise BOTH states are named — marking only the shared ones would
 * leave a bare row meaning "the other thing", which is the same blank-means-
 * something trap as an empty count cell.
 *
 * The wording matches the compose form's two options so the list reads back what
 * she chose in the words she chose it in.
 */
export function replyScopeNote(reply: ScopedReply, siteCount: number): string | null {
  if (siteCount <= 1) return null;
  return isSharedReply(reply) ? 'All my sites' : 'This site only';
}

/**
 * What the delete confirmation says.
 *
 * A shared reply is removed from every site at once, and the old sentence said
 * only "your team will no longer be able to send this saved reply" — true, and
 * silent about the six other sites it just left.
 */
export function deleteReplyWarning(reply: ScopedReply, siteCount: number): string {
  if (siteCount > 1 && isSharedReply(reply)) {
    return (
      `This reply is offered on all ${String(siteCount)} of your sites, so it goes from every ` +
      'one of them. Your team will no longer be able to send it anywhere. This cannot be undone.'
    );
  }
  return 'Your team will no longer be able to send this saved reply. This cannot be undone.';
}

// ─── CHANGING ONE, RATHER THAN DELETING IT AND TYPING IT AGAIN ──────────────
//
// A saved reply had exactly two verbs: add and delete. The seven this console
// seeds on the day the chat box is switched on are deliberately generic starting
// copy — "Business hours: Monday to Friday, 9am to 5pm", "Returns", "Shipping
// times" — and the code that writes them says out loud that the business "edits
// or replaces" them. Nothing could edit one. A shop open Thursday to Sunday had
// to delete the reply and retype it from nothing, remembering the shortcut and
// the site choice, with the reply missing from her team's inbox in between.
//
// 102 saved replies on this platform, and not one of them had ever been changed,
// because nothing could change one.

/** The fields of a saved reply a person can change on this screen. */
export interface EditableReply {
  title: string;
  body: string;
  /** The word typed to send it, or null when it has none. */
  shortcut: string | null;
  propertyId: string | null;
}

/** What is in the boxes right now. `shortcut` is '' when the box is empty. */
export interface ReplyDraft {
  title: string;
  body: string;
  shortcut: string;
  scope: 'site' | 'all';
}

/** The reply's own scope, in the two words the form offers. */
export function scopeOf(reply: EditableReply): 'site' | 'all' {
  return reply.propertyId === null ? 'all' : 'site';
}

/**
 * True once people are typing this reply's shortcut to send it.
 *
 * The shortcut is the one thing on this screen that is NOT hers to change
 * afterwards, which is the same rule the saved-paragraphs screen next door
 * states: it is what an agent types without thinking, so re-pointing it breaks
 * the habit everywhere at once while the old word quietly returns nothing.
 *
 * But a quick reply's shortcut is OPTIONAL, so a reply can be sitting there
 * without one — and there no habit exists to break. Giving a reply its first
 * shortcut is allowed; changing one already in use is not. That is the whole
 * rule, and it is one sentence long.
 */
export function shortcutIsFixed(reply: EditableReply): boolean {
  return (reply.shortcut ?? '').trim() !== '';
}

/** Why the shortcut is shown as a fact rather than offered as a box. */
export function fixedShortcutNote(reply: EditableReply): string {
  return (
    `Fixed once it is in use: /${(reply.shortcut ?? '').trim()} is what your team types without ` +
    'thinking, so changing it would break the habit while the old word quietly stopped working. ' +
    'Delete this reply and make another if it is genuinely wrong.'
  );
}

/**
 * Which fields the boxes would actually change.
 *
 * The console works this out BEFORE calling anything, so pressing Save on a
 * reply nobody touched says so instead of reporting work it did not do. That is
 * the rule the review queue learnt the hard way: a decision that changes nothing
 * is not recorded as a decision.
 *
 * `siteId` is the site being worked in, which is what "This site only" means.
 * When it is not known yet, scope is left out of the comparison rather than
 * guessed — a guess here silently moves a reply between her businesses.
 */
export function changedReplyFields(
  saved: EditableReply,
  draft: ReplyDraft,
  siteId: string | null
): ('title' | 'body' | 'shortcut' | 'scope')[] {
  const changed: ('title' | 'body' | 'shortcut' | 'scope')[] = [];
  if (draft.title.trim() !== saved.title) changed.push('title');
  if (draft.body.trim() !== saved.body) changed.push('body');
  // A fixed shortcut is never sent, so it can never be part of the difference.
  if (!shortcutIsFixed(saved) && draft.shortcut.trim() !== '') changed.push('shortcut');
  if (siteId !== null && draft.scope !== scopeOf(saved)) changed.push('scope');
  return changed;
}

/** The words on the form while it is editing rather than adding. */
export interface EditFormWords {
  heading: string;
  submit: string;
  /** The sentence under the heading, or null while adding. */
  note: string | null;
}

export function editFormWords(editing: EditableReply | null): EditFormWords {
  if (!editing) {
    return { heading: 'Add a quick reply', submit: 'Add quick reply', note: null };
  }
  return {
    heading: `Change “${editing.title}”`,
    submit: 'Save changes',
    // Named out loud because the form is the same three boxes either way, and a
    // person who scrolled down to press a pencil needs the screen to agree that
    // is what happened.
    note: 'Your team sends the new wording from the next message on. Conversations already sent are untouched.',
  };
}

/** What the toast says after a save that did, or did not, move anything. */
export interface SaveWords {
  title: string;
  description?: string;
  type: 'success' | 'info';
}

export function savedReplyWords(reply: EditableReply, changedCount: number): SaveWords {
  if (changedCount === 0) {
    return {
      title: 'Nothing to change',
      description: `“${reply.title}” already says exactly that.`,
      type: 'info',
    };
  }
  return { title: `“${reply.title}” saved`, type: 'success' };
}
