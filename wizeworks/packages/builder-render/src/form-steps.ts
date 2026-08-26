'use client';

// One long form, shown a step at a time (docs/151 §7, docs/152 C2).
//
// ── WHY THE STEPS COME FROM THE DOM ──────────────────────────────────────────
//
// The fields in a builder form are author-composed nodes, not a hardcoded field
// list, and by the time the island sees them they are already React children it
// cannot inspect. So a step is declared the way every other structural part in
// this system is declared — `part(node, 'item')` on the container, which the
// walker lowers to `data-sx-item` — and read back off the rendered DOM. `toc`
// already works exactly this way, reading the headings it indexes rather than
// being handed them.
//
// The consequence worth knowing: a form with NO marked steps has one step, which
// is the plain form that already existed. Nothing about single-step forms
// changes, and an author who marks nothing loses nothing.
//
// Everything below the hook is a plain function over a form element, which is
// what makes it testable — the island itself only ever server-renders in tests.

import { useCallback, useEffect, useRef, useState } from 'react';

const CONTROLS = 'input, select, textarea';
const NAMED_CONTROLS = 'input[name], select[name], textarea[name]';

/** A step's container, in document order. */
export function formSteps(form: HTMLFormElement): HTMLElement[] {
  return Array.from(form.querySelectorAll<HTMLElement>('[data-sx-item]')).filter(
    // A marked item belonging to some other behavior inside this form is
    // possible; `closest` keeps us to the steps that are actually ours.
    (el) => el.closest('form') === form
  );
}

/**
 * Show one step, hide the rest.
 *
 * Hiding is `hidden` on the container rather than unmounting, and that is what
 * keeps a half-filled form intact: somebody who goes Back and forward again must
 * find what they already typed still there. It also means `new FormData(form)`
 * on the final submit still sees every answer, so the submit path needed no
 * changes at all.
 */
export function showStep(steps: HTMLElement[], index: number): void {
  steps.forEach((step, i) => {
    step.hidden = i !== index;
  });
}

/** Is everything the visitor can currently SEE valid? Only the visible step is
 *  checked — validating the whole form would refuse to advance because of a
 *  required field three screens ahead that nobody has been shown yet, with no
 *  visible explanation for the refusal. Reports the first problem. */
export function stepIsValid(step: HTMLElement | undefined): boolean {
  if (!step) return true;
  const controls = Array.from(step.querySelectorAll<HTMLElement>(CONTROLS));
  for (const control of controls) {
    const c = control as HTMLInputElement;
    if (typeof c.checkValidity === 'function' && !c.checkValidity()) {
      c.reportValidity?.();
      return false;
    }
  }
  return true;
}

/**
 * The answers given on the steps completed so far.
 *
 * Bounded at `index` on purpose: a later step's fields are already in the DOM and
 * empty, and sending empty strings for them would blank real answers on a form
 * somebody resumed. Unchecked boxes and file inputs are skipped for the same
 * reason — neither has a value worth recording as one.
 */
export function valuesUpTo(steps: HTMLElement[], index: number): Record<string, string> {
  const out: Record<string, string> = {};
  for (const step of steps.slice(0, index + 1)) {
    for (const control of Array.from(step.querySelectorAll<HTMLElement>(NAMED_CONTROLS))) {
      const c = control as HTMLInputElement;
      if (c.type === 'file') continue;
      if ((c.type === 'checkbox' || c.type === 'radio') && !c.checked) continue;
      const value = (c.value || '').trim();
      if (!value) continue;
      // A repeated name (a checkbox group) accumulates rather than overwriting,
      // matching how the final submit collects the same fields.
      out[c.name] = c.name in out && out[c.name] ? `${out[c.name]}, ${value}` : value;
    }
  }
  return out;
}

export interface FormSteps {
  /** How many steps there are. 1 for an ordinary single-step form. */
  count: number;
  /** Which one is showing, 0-based. */
  index: number;
  isLast: boolean;
  /** Advance if the visible fields are valid. Returns whether it moved. */
  next: () => boolean;
  back: () => void;
  /** The answers from the steps completed so far, for the partial capture. */
  valuesSoFar: () => Record<string, string>;
}

/** Wire a form element up as a stepped form. */
export function useFormSteps(): {
  formRef: React.RefObject<HTMLFormElement | null>;
  steps: FormSteps;
} {
  const formRef = useRef<HTMLFormElement | null>(null);
  const [index, setIndex] = useState(0);
  const [count, setCount] = useState(1);

  // Re-read on every index change: the tree can be re-rendered underneath us in
  // the canvas, and a stale step count would strand somebody on a step that no
  // longer exists.
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const steps = formSteps(form);
    setCount(Math.max(1, steps.length));
    if (steps.length > 0) showStep(steps, index);
  }, [index]);

  const next = useCallback((): boolean => {
    const form = formRef.current;
    if (!form) return false;
    const steps = formSteps(form);
    if (!stepIsValid(steps[index])) return false;
    if (index >= steps.length - 1) return false;
    setIndex(index + 1);
    return true;
  }, [index]);

  const back = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  const valuesSoFar = useCallback((): Record<string, string> => {
    const form = formRef.current;
    if (!form) return {};
    return valuesUpTo(formSteps(form), index);
  }, [index]);

  return {
    formRef,
    steps: { count, index, isLast: index >= count - 1, next, back, valuesSoFar },
  };
}
