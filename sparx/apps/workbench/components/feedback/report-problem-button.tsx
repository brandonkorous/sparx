'use client';

// "Tell us what happened" — a way out of a dead end.
//
// A failure message is the one place in the app where a person is stuck AND has
// something worth telling us, and it is also the place they are least able to write
// the report: the useful detail is a scope name, a status code or a vendor's own
// error text, and what they will remember an hour later is "it said something about
// permissions". So the screen writes the report and they add the sentence only they
// can add.
//
// Everything about the composer is unchanged — same inbox, same threads, same reply.
// The only difference is that it opens with the category already set to `problem` and
// the body already describing what the screen just saw. The pane, module, site and
// the panes they passed through on the way are attached by the context capture, which
// is why this needs no props about where it is.
//
// The `source` stays `button`. A new one would have to be added to the API's enum,
// to the `feedback.submitted` event payload in @wizeworks/events and to the admin inbox
// that renders it — a published contract widened for a label that the context payload
// (`workbench:platform.migrate.run`) already carries more precisely.

import { Button, type ButtonProps } from '@wizeworks/silicaui-react';
import { LifeBuoy } from 'lucide-react';
import { useFeedback } from './provider';

export interface ReportProblemButtonProps {
  /** One line naming what failed. Becomes the subject. */
  subject: string;
  /**
   * What the screen knows, verbatim — the vendor's message, the status, the hint.
   * Written as prose rather than a stack trace, because a human reads it first and
   * the person sending it can see every word before it goes.
   */
  details: string;
  label?: string;
  size?: ButtonProps['size'];
  variant?: ButtonProps['variant'];
  color?: ButtonProps['color'];
  className?: string;
}

export function ReportProblemButton({
  subject,
  details,
  label = 'Tell us what happened',
  size = 'sm',
  variant = 'outline',
  color,
  className,
}: ReportProblemButtonProps) {
  const feedback = useFeedback();

  return (
    <Button
      size={size}
      variant={variant}
      {...(color === undefined ? {} : { color })}
      {...(className === undefined ? {} : { className })}
      onClick={() => {
        feedback.openSend({
          category: 'problem',
          prefill: {
            subject,
            // The blank line and the trailing prompt matter: the cursor lands under a
            // question, so the box reads as "add your bit" rather than as a finished
            // message somebody has to decide whether to edit.
            body: `${details}\n\nWhat I was trying to do:\n`,
          },
        });
      }}
    >
      <LifeBuoy className="size-4" aria-hidden />
      {label}
    </Button>
  );
}
