// "So which one do my customers actually get?"
//
// A template carries two independent booleans — `isDefault` and `published` —
// and NEITHER of them answers that question on its own. A published template
// that is not the default is in force nowhere. A default that has never been
// published is in force nowhere either: the print routes fall back to the
// built-in layout, which is the right behavior and completely invisible.
//
// So the screen must never print "Default" and "Published" as two badges and
// leave the owner to combine them. Four states, each named as an outcome rather
// than as a flag, and the two that mean "your customers are NOT seeing this"
// say so. [[feedback_never_present_absence_as_measurement]]

/**
 * The badge's color, or null for a COLORLESS badge.
 *
 * A union rather than `string` so a typo is a type error — `SilicaColor` accepts
 * any string, which catches nothing.
 *
 * Null is the "Draft" case and is deliberate: a draft is not a state the
 * template is IN, it is the absence of one, and there is nothing for a color to
 * distinguish it from. A bare `.badge` resolves to the surface's own ink, which
 * is the right answer and is not the same thing as naming `neutral`.
 */
export type StandingTone = 'success' | 'warning' | 'info' | null;

export interface TemplateStanding {
  /** What it is, in one or two words, on a badge. */
  label: string;
  /** The whole answer, for a row title and the editor's own line. */
  sentence: string;
  tone: StandingTone;
  /** Is this the one a customer opening a bill actually receives? */
  inForce: boolean;
}

export interface StandingInput {
  isDefault: boolean;
  published: boolean;
  /** The business it belongs to, for a sentence that can name it. Null is the
   *  shared tier. */
  propertyName?: string | null;
}

/** Who this is in force for, in words. The shared tier is the ordinary case and
 *  reads as the plain sentence, so an account with one business never sees a
 *  qualification it has no use for. */
function forWhom(propertyName: string | null | undefined): string {
  return propertyName ? ` for ${propertyName}` : '';
}

export function templateStanding({
  isDefault,
  published,
  propertyName,
}: StandingInput): TemplateStanding {
  const whom = forWhom(propertyName);

  if (isDefault && published) {
    return {
      label: 'In use',
      sentence: `This is what your customers get${whom}.`,
      tone: 'success',
      inForce: true,
    };
  }
  if (isDefault && !published) {
    // The quiet one. Picking a template does nothing until it is published, and
    // nothing on the page said so, so an owner who chose their letterhead and
    // walked away would keep sending the built-in one indefinitely.
    return {
      label: 'Not turned on',
      sentence: `Chosen${whom}, but never published, so customers still get the standard layout. Press Publish to start using it.`,
      tone: 'warning',
      inForce: false,
    };
  }
  if (published) {
    return {
      label: 'Ready',
      sentence: `Published, but it is not the one in use${whom}. Press Use this one to switch to it.`,
      tone: 'info',
      inForce: false,
    };
  }
  return {
    label: 'Draft',
    sentence: 'Only you can see this. Nothing has been sent on it.',
    tone: null,
    inForce: false,
  };
}
