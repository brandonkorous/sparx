# 164 — A signed-in customer was treated as a stranger in chat

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 10 (a customer message answered)
**Surface:** the Gillett site › the chat box; workbench › Messages › a conversation; same in Piggles
**Filed:** 2026-10-08
**Fixed:** 2026-10-08
**Confirmed by:** P01 on screen, 2026-10-08 (sparx)
**Blocked on:** —

## What happened

Renée Castañeda was signed in to Gillett's site ("Renée" at the top of the page). She
opened the chat box. It asked "Your name (optional)" and "Email (optional)", as it
would ask a stranger.

In the workbench, her chat came in marked "Possible customer": sparx had matched the
email she typed against Gillett's customers. Had she typed nothing, or a different
address, she would have been nobody.

## What should have happened

A customer who is signed in is known. The chat says who she is chatting as, does not
ask for her name and email, and reaches Doty as his customer Renée Castañeda, with her
orders beside it.

## How to reproduce

1. As Renée (`renee.castaneda@wasatchutility.test`), sign in on
   `http://localhost:3004/?tenant=gillettdiesel`.
2. Open the chat box. It asks for a name and an email.
3. Send a message. In the workbench, Messages: "Possible customer". Every time.

## Why it matters

The one customer sparx can be sure of is treated as the one it cannot. A fleet buyer
with $7,357.45 in orders is asked who she is, and Doty is told she might be his
customer.

## Where it lives

- `wizeworks/packages/chat-widget/src/ChatWidget.tsx`: started every chat straight at
  the API (`apiUrl`). The API takes no sign-in cookie from another site, so it never
  knew who was signed in. It also never said which site it was on (`property=`).
- `wizeworks/apps/site/components/site-chat-widget.tsx`: knew the signed-in customer
  (`useCustomer()`) and passed nothing.
- `wizeworks/services/api-rest/src/routes/v1/public/chat.ts`: the start route only
  matched on a typed email.

## The fix

- The widget takes three new props (`types.ts`): `propertySlug` (sent as `property=`
  on every call), `startVia` (where the first message goes, when that is a same-site
  relay that carries the sign-in cookie), and `signedInAs`. When `signedInAs` is set,
  the box says "Chatting as **Renée Castañeda**. We will answer here." in place of the
  two inputs, and sends no typed name or email.
- The Gillett site's widget (`site-chat-widget.tsx`) passes the site, its own
  `/api/sparx` relay, and the signed-in customer.
- The start route reads the shopper's session (`optionalCustomer`, the same reader the
  rest of the shopper routes use) and, when there is one, ties the conversation to
  their customer record. A chat started without the relay stays anonymous, exactly as
  before.
- The line "We will answer here." also answers the missing acknowledgement for a
  signed-in shopper. Piggles uses the same widget and the same site, so it has the fix.

No automated test: the session read is the shared shopper reader, and the rest is
props. Lint clean. Typecheck not run (Brandon: leave it for now).

## Confirmed by

P01 on screen, 2026-10-08 (sparx): as Renée, signed in, on the Contact page, the chat
box read "Chatting as Renée Castañeda. We will answer here." with no inputs. She sent
"Doty, can you add two fuel filter kits for the 6.7L to our Thursday drop-off? Same PO
as Unit 31." In the database the new conversation had her `customer_id`
(`fd7795a2-…`) and Gillett's site, and no typed name or email. In the workbench,
Messages › Renée Castañeda showed the badge "Customer" (not "Possible customer"), her
5 orders and her last 3. Doty answered from there and the reply was sent.

Not checked on screen: the Piggles console.

## Rating effect

—
