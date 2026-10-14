// What Publish does, said for the email in hand (sparx persona issue 156).
//
// An email with a `key` is one sparx sends by itself when something happens to a
// customer (`welcome-customer` is the welcome a new customer gets), so
// publishing it changes what goes out from then on. Any other email goes out
// only when the owner sends it to an audience, so publishing it sends nothing.
// One sentence for both read, over a fleet newsletter, as "this emails everyone
// now".

export function publishDescription(email: { key: string | null }): string {
  return email.key
    ? 'This is an email sparx sends by itself. Publishing makes this exact design the one your customers receive from now on. Your current draft is saved and captured as the live version.'
    : 'Publishing sends nothing. It makes this exact design ready to choose when you “Write an email” to your customers. Your current draft is saved and captured as the live version, and later edits stay a draft until you publish again.';
}
