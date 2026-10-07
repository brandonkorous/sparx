import { useEffect, useState, type RefObject } from 'react';
import { deskProgress, OPENING, settleAt, STOPS } from './clock';

type NoteRefs = RefObject<(HTMLDivElement | null)[]>;

/** True when the desk drives the day: wide screen, motion allowed. Answered by
 *  the stylesheet's own media query so the two can never disagree. */
export function useContained() {
  const [contained, setContained] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1081px)');
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setContained(mq.matches && !motion.matches);
    sync();
    mq.addEventListener('change', sync);
    motion.addEventListener('change', sync);
    return () => {
      mq.removeEventListener('change', sync);
      motion.removeEventListener('change', sync);
    };
  }, []);
  return contained;
}

/** Small screens: the note sitting on the reading line is the current beat. */
function readingLineBeat(noteRefs: NoteRefs) {
  const line = window.innerHeight * 0.66;
  let n = 0;
  noteRefs.current.forEach((el, i) => {
    if (el && el.getBoundingClientRect().top <= line) n = i + 1;
  });
  return n;
}

/** The day scrolls INSIDE the desk on wide screens, so the section costs the
 *  page one screen instead of a six-screen spacer. Small screens follow the page.
 *  Scroll chaining hands the scroll back to the page after the last beat. */
export function useDayClock(
  contained: boolean,
  deskRef: RefObject<HTMLDivElement | null>,
  noteRefs: NoteRefs
) {
  const [beat, setBeat] = useState(0);
  const [mins, setMins] = useState(OPENING);

  const onDeskScroll = () => {
    const desk = deskRef.current;
    if (!contained || !desk) return;
    const s = settleAt(deskProgress(desk));
    setBeat(s.beat);
    setMins(s.mins);
  };

  useEffect(() => {
    if (contained) {
      const desk = deskRef.current;
      if (desk) {
        const s = settleAt(deskProgress(desk));
        setBeat(s.beat);
        setMins(s.mins);
      }
      return;
    }
    const onScroll = () => {
      const n = readingLineBeat(noteRefs);
      setBeat(n);
      setMins(STOPS[n]!);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [contained, deskRef, noteRefs]);

  return { beat, mins, onDeskScroll };
}

/** Small screens: keep the newest window in view by SCROLLING the column, not
 *  transforming it, so no inline style is needed. */
export function useStackFollow(
  stackRef: RefObject<HTMLDivElement | null>,
  beat: number,
  contained: boolean
) {
  useEffect(() => {
    const stack = stackRef.current;
    if (contained || !stack) return;
    const target = stack.children[Math.max(0, beat - 1)] as HTMLElement | undefined;
    stack.scrollTo({
      top: beat === 0 || !target ? 0 : target.offsetTop - 12,
      behavior: 'smooth',
    });
  }, [beat, contained, stackRef]);
}
