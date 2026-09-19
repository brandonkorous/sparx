# 629 — Two people wrote in from my website and nothing anywhere counted them

**Status:** fixed
**Severity:** medium
**Found by:** P03 · Juniper Row · act 212
**Surface:** mypiggles › Home, the app rail, My Site
**Filed:** 2026-09-17
**Fixed:** 2026-09-17
**Confirmed by:** P03 · Juniper Row · act 212 (seen on screen, before and after)

## What happened

My Site › Form replies:

```
Rosalind Achebe    I am between a S and an M in the Ash Overshirt…   Sep 1    New
Hanne Sorensen     Is the Sunday Trouser cut for someone…           Aug 31   New
Tomas Ferreira     Do you ever make the Ash Overshirt in…           Aug 31   New
Marguerite Okoye   I am between sizes on the Marlow Knit…           Aug 31   Read
```

Today is September 17. Three people asked me about sizing more than two weeks
ago and are still marked New.

Home, at the same moment, said **2 things are waiting for you** and listed late
invoices and a sold-out item. The app rail badged Stock and Invoices. Nothing
anywhere counted the people.

## What I checked before calling it a defect

**She was told.** The seeded automation ran:

```
Handle form submissions   active   trigger form.submitted
automation_runs:          4 completed, all 2026-09-01
```

So an email went out for every one. This is not "nobody told her" — it is that
the console, which is where she looks every morning, did not.

## Why it happened

`home-counts.ts` declares what is waiting, as eight queries. Seven channels had
one. The oldest and plainest did not:

| channel                       | counted |
| :---------------------------- | :------ |
| orders to send                | yes     |
| live chat waiting             | yes     |
| bookings to confirm           | yes     |
| invoices late                 | yes     |
| stock running low / sold out  | yes     |
| social inbox                  | yes     |
| posts awaiting approval       | yes     |
| **somebody filled in a form** | **no**  |

Live chat is counted and a form reply is not, and to the person who wrote it
those are the same act. This is the console's own pattern left unfinished, not a
new capability: `COUNT_SURFACE` badges a screen, the rail sums screens into an
app and apps into a group, all from one line.

## The fix

One source, one screen, one sentence:

```ts
formReplies: {
  key: 'formReplies',
  module: 'builder',
  path: '/v1/forms/submissions',
  query: { status: 'new', limit: 1 },
  read: (data) => …counts.new,
},
```

The endpoint **already answered `counts.new`** beside every window it served, so
this asks for the number and one row rather than the inbox.

Home gets a tile beside live chat, with `params: { status: 'new' }` so the number
in the sentence is the number of rows behind it when she opens it (the rule from
issue 258).

On screen:

|                | before                         | after                                         |
| :------------- | :----------------------------- | :-------------------------------------------- |
| Home           | "2 things are waiting for you" | **"3 things are waiting for you"**            |
| Home, top line | (absent)                       | **"2 people wrote to you from your website"** |
| the rail       | Stock 1 · Invoices 8           | **My Site 2** · Stock 1 · Invoices 8          |

The quiet line underneath moved with it, correctly: it still reads "everything is
sent, everyone has had a reply, no bookings are waiting and nothing is running
low" and no longer implies the website is quiet too.

## Guard

Two in `home-counts.test.ts`:

```ts
it('counts the people who wrote in from the website', …)
it('asks for one row, because only the total is wanted', …)   // widened
```

The widened one matters on its own. It looped for `take === 1` and the forms
inbox spells its page size `limit`, so it would have gone on passing while the
newest count pulled a full window on every poll. It now asserts both words.

The new test also pins that an unrecognised response shape reads **unknown, not
zero** — a count that says "nobody is waiting" because it could not parse the
answer is the worst of the three states
([[feedback_never_present_absence_as_measurement]]).

TypeScript caught the half-done edit: adding the key to `SOURCES` made
`useAttention`'s return type incomplete and the build failed until the hook was
wired. That is the right guard for a table of this shape.

## Led straight to the next one

Wiring this count made `GET /v1/forms/submissions` the source of a BADGE, and its
own header said "list (tenant-wide, newest first)". A tenant-wide number on a
per-site badge would put "2 people wrote to you" on a business nobody wrote to,
so it is fixed in
[630](630-the-form-inbox-answered-for-every-site-she-runs.md).
