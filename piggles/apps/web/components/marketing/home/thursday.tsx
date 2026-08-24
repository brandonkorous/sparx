import Image from 'next/image';
import Link from 'next/link';
import { Section } from '@piggles/ui';
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import { accountUrl } from '@piggles/config';

// ── 1b · RECOGNITION ─────────────────────────────────────────────────────────
//
// The film shows a day going well. This is the day the reader actually had, and
// it goes immediately after — because a page that only ever shows the good
// version is a page nobody sees themselves in. Pain first, then the product, is
// the usual advice; here the product came first because the film IS the
// argument, so this is the beat that earns it retrospectively: yes, that is a
// nice Thursday, and here is yours.
//
// ── SHORT, AND IT ASKS FOR SOMETHING ────────────────────────────────────────
//
// This was four paragraphs and no buttons first — a recognition beat written as
// an essay, which is the opposite of recognition: you either see yourself in it
// in one line or the extra sentences are you explaining somebody's own week back
// to them. Forty words now, and it ends where the reader is most likely to act,
// which is the moment they have just agreed the problem is theirs.
//
// ── WHY THE PAIN CLAUSE IS NOT PINK ─────────────────────────────────────────
//
// The reference this was built from sets the last line of the heading in the
// brand pink. It cannot ship that way: `--color-primary` measures 2.6:1 as ink
// on `base-100` and fails even the 3:1 large-text floor. Pink is a FILL in this
// palette — the theme pairs it with an on-fill ink — and using a fill as an ink
// is how a heading ends up decorative rather than read. Same measurement as
// <Whatever> records for the same reason.
//
// The emphasis is carried by SCALE instead, and the color goes where it can be
// read AND mean something: the four nouns in the paragraph wear the group hue of
// the app that eventually absorbs them. Every group hue is measured AA on white
// (4.99–6.98:1), so they are legible, and a reader meets the product's color
// system here — in a sentence about their own week — before the trade wall or
// the nav ever shows it to them.
function Words() {
  return (
    <div className="rise">
      <h2 className="text-4xl leading-[1.04] font-black sm:text-5xl lg:text-6xl">
        It&rsquo;s Thursday night, and you&rsquo;re still doing the admin.
      </h2>

      <p className="mt-6 max-w-[46ch] text-lg sm:text-xl">
        <b data-group="people" className="ink-module font-bold">
          Bookings
        </b>{' '}
        in one app,{' '}
        <b data-group="money" className="ink-module font-bold">
          invoices
        </b>{' '}
        in another,{' '}
        <b data-group="sell" className="ink-module font-bold">
          stock
        </b>{' '}
        in a spreadsheet,{' '}
        <b data-group="people" className="ink-module font-bold">
          customers
        </b>{' '}
        in your phone. None of them have ever spoken to each other.
      </p>

      <p className="font-heading mt-7 text-2xl leading-[1.1] font-black sm:text-3xl">
        That is why we built Piggles.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <a
          className={buttonClasses({ color: 'primary', size: 'lg' })}
          href={accountUrl('signup', 'home-why')}
        >
          Start free for 14 days
        </a>
        {/* `/apps`, not the in-page `#apps` anchor it pointed at. An anchor
                is not a destination — it drops somebody 3,000px down the same
                page they were already reading, which is the scroll they were
                going to do anyway. */}
        <Link className={buttonClasses({ variant: 'outline', size: 'lg' })} href="/apps">
          See what&rsquo;s included
        </Link>
      </div>
    </div>
  );
}

export function Thursday() {
  return (
    <Section variant="panel" className="bg-base-100 shadow">
      <div id="why" className="grid gap-10 lg:grid-cols-[1.12fr_0.88fr] lg:items-center lg:gap-16">
        <Words />

        {/* The alt describes WHAT IS IN THE FRAME, not what the section wants it
            to mean — public/photos/README.md records a caption written from a
            filename that shipped describing a picture nobody had opened. */}
        <Image
          src="/photos/working-late-portrait.jpg"
          alt="Someone still working at a laptop after dark, city lights in the window behind them"
          width={1200}
          height={1500}
          sizes="(min-width: 1024px) 42vw, 100vw"
          className="settle rounded-section h-auto w-full"
        />
      </div>
    </Section>
  );
}
