'use client';

import { useEffect, useRef, useState } from 'react';

// THE HERO. The footage is not an illustration beside the argument — it IS the
// top of the page, and the copy sits on it.
//
// Why it changed. The first version put the montage in a panel to the right of
// the headline, which made it a picture next to some words: the page still
// opened with type, and the whole point of the footage is that a visitor should
// see eight kinds of business before they read a single claim about "whoever you
// are". Full-bleed puts the evidence first and the sentence second.
//
// OUR OWN TREATMENT, not sparx's. sparx also runs footage full-bleed, and lays a
// flat charcoal scrim over the whole frame with the headline knocked out in
// white — confident, cold, and it costs the footage all its colour. Piggles
// instead drops a SOLID rounded panel onto the left of the frame and leaves the
// rest of the picture completely untouched. Three things follow from that:
//
//   • No scrim, so the video keeps its own light. The warmth is the brand.
//   • Text sits on a real surface with a real ink token, so contrast is a fact
//     rather than a hope — nothing here depends on how bright a given frame is.
//     A headline over open footage is a contrast bug waiting for the one clip
//     that happens to cut to a white wall.
//   • The panel is `rounded-box` (18px), the same radius as every card on the
//     page, so the hero belongs to the same object family as everything below it.
//
// Performance and a11y:
//   • Nothing is fetched until the panel is near the viewport, and never on a
//     small screen or under `prefers-reduced-motion` — the poster renders
//     instead. 36 MB is not a thing to send to a phone on cellular to decorate a
//     headline.
//   • One clip is in flight at a time; `src` is swapped on `ended` rather than
//     mounting eight elements.
//   • Clips are muted + playsInline so autoplay is permitted, and `aria-hidden`
//     because they are illustration — the labels below the copy are real text and
//     carry the same information.

const CLIPS = [
  { src: '/video/whoever-seller.mp4', label: 'A shop' },
  { src: '/video/whoever-maker.mp4', label: 'A maker' },
  { src: '/video/whoever-tailor.mp4', label: 'A tailor' },
  { src: '/video/whoever-salon.mp4', label: 'A salon' },
  { src: '/video/whoever-studio.mp4', label: 'A studio' },
  { src: '/video/whoever-workshop.mp4', label: 'A workshop' },
  { src: '/video/whoever-dropship.mp4', label: 'A supplier' },
  { src: '/video/whoever-retail.mp4', label: 'A storefront' },
] as const;

const POSTER = '/video/whoever-poster.jpg';

export function HeroVideo({ children }: { children: React.ReactNode }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [index, setIndex] = useState(0);

  // Arm only when the frame is close to view, and never on a small screen or
  // under reduced motion. Returning early leaves `playing` false, which renders
  // the poster — a complete, correct state rather than a degraded one.
  useEffect(() => {
    const mq = window.matchMedia;
    if (mq('(prefers-reduced-motion: reduce)').matches || mq('(max-width: 1023px)').matches) return;

    const el = wrapRef.current;
    if (!el) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setPlaying(true);
            io.disconnect();
            break;
          }
        }
      },
      { rootMargin: '300px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    const clip = CLIPS[index];
    if (!v || !playing || !clip) return;
    v.src = clip.src;
    v.load();
    // A rejected autoplay is not an error worth surfacing — the poster is
    // already behind the element and the section still reads.
    void v.play().catch(() => undefined);
  }, [playing, index]);

  const current = CLIPS[index] ?? CLIPS[0];

  return (
    <section className="bg-secondary relative isolate overflow-hidden lg:flex lg:min-h-[38rem] lg:items-center">
      {/* In flow on a phone (picture first, then the words); the full frame from
          `lg` up, where the copy panel is laid over it. */}
      <div
        ref={wrapRef}
        className="relative h-72 w-full sm:h-96 lg:absolute lg:inset-0 lg:h-full"
        aria-hidden
      >
        {playing ? (
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            poster={POSTER}
            muted
            playsInline
            autoPlay
            preload="auto"
            onEnded={() => setIndex((n) => (n + 1) % CLIPS.length)}
          />
        ) : (
          // Deliberately a plain <img>: this is a poster frame that must paint in
          // the same commit as the section, and next/image's wrapper + lazy
          // machinery buys nothing for a single always-visible asset that is
          // already the exact size it renders at.
          <img src={POSTER} alt="" className="h-full w-full object-cover" />
        )}
      </div>

      <div className="relative mx-auto w-full max-w-7xl px-6 py-12 lg:py-20">
        <div className="rounded-box bg-base-100 text-base-content max-w-2xl p-8 sm:p-10">
          {children}

          {/* The real text alternative for the footage, which is why the video
              can be aria-hidden. Inside the panel rather than on the picture:
              a soft badge laid over moving video is exactly the fading-to-
              illegible this house bans, and here it costs nothing to avoid. */}
          <ul className="border-base-300 mt-8 flex flex-wrap gap-2 border-t pt-6">
            {CLIPS.map((c) => (
              <li key={c.label}>
                <span
                  className={
                    c.label === current.label
                      ? 'badge badge-primary badge-lg'
                      : 'badge badge-neutral badge-soft badge-lg'
                  }
                >
                  {c.label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
