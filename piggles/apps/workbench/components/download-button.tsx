'use client';

// DOWNLOAD BUTTON — the one place the console turns "give me that as a file"
// into a file on somebody's disk.
//
// ── The first defect: a control with no words on it ──────────────────────────
//
// Six call sites across three Stock surfaces wrote the same thing:
//
//   <Button render={<a href={…} download><Icon/>Spreadsheet</a>} />
//
// and every one rendered an empty 30×38 box. Silica's `render` follows Base UI's
// composition model: the element passed in supplies the TAG and its props, and
// the CONTROL supplies the children. A control written self-closing has no
// children, so it renders none, and the label sitting inside the anchor is
// discarded. The documented form is the other way round:
//
//   <Button render={<a href="/docs" />}>Docs</Button>
//
// Nothing failed. The href was right, the classes were right, the thing was
// clickable — it just had no word on it.
//
// ── The second defect: the anchor was never a link ───────────────────────────
//
// Collecting those six into this component fixed the label and kept the anchor,
// with a comment prizing the fact that right-click → save-as would still work.
// It could not. api-rest is reached with a bearer token at an origin this
// console only learns at RUNTIME from `/api/token`, and an `<a href>` carries
// neither. A bare `/v1/...` href resolved against the CONSOLE's own origin, so
// every download in Stock fetched localhost:3022, which has no such route, and
// saved Next's app shell: 146KB of HTML named `template.html`.
//
// So the on-ramp of the whole import flow — "download what you have, count the
// shelves, upload it back" — handed a shop owner a web page to count. It threw
// nothing, logged nothing and looked exactly like a working download.
//
// It is a real button now, over `downloadServerFile`, which is where the "an
// anchor cannot carry the Authorization header" reasoning had already been
// written down before this component existed.
// [[feedback_screen_over_a_function_nobody_calls]]
//
// ── Why a component and not eight corrected call sites ───────────────────────
//
// Correcting eight call sites fixes the eight that exist and none of the ones
// written next month, which is the definition of a deferred fix. The contract is
// subtle enough that it has now gone wrong twice, in two different ways, at
// every call site at once. It belongs in one place. Same reasoning as
// `components/table.tsx`.

import { useState } from 'react';
import { Button, useToast } from '@wizeworks/silicaui-react';
import { faDownload, faSpinner } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';

import { apiErrorMessage } from '../lib/api-error';
import { downloadServerFile } from '../lib/api/download';

export function DownloadButton({
  path,
  filename,
  label,
  className,
}: {
  /** api-rest's own path, with its query: `/v1/inventory/reports/x?format=csv`.
   *  NOT an href — the API origin is resolved at click time, and a relative one
   *  would fetch this console instead. */
  path: string;
  /** What to save it as when the route names no filename of its own. The route
   *  normally does, and its name wins, because a caller's hardcoded one is how
   *  two periods of the same export save over each other. */
  filename: string;
  /** The words on the button, and its accessible name. One value, both jobs. */
  label: string;
  className?: string;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const save = () => {
    if (busy) return;
    setBusy(true);
    void downloadServerFile(path, filename)
      .catch((error: unknown) => {
        // A download that fails is otherwise completely silent: no row changes,
        // no file appears, and the person is left to decide whether to press it
        // again. The server's own sentence says which it is.
        toast.add({
          title: 'That file could not be downloaded',
          description: apiErrorMessage(error, 'Try again in a moment.'),
          type: 'error',
        });
      })
      .finally(() => {
        setBusy(false);
      });
  };

  return (
    <Button
      color="neutral"
      variant="outline"
      size="sm"
      disabled={busy}
      onClick={save}
      {...(className ? { className } : {})}
    >
      <Icon
        glyph={busy ? faSpinner : faDownload}
        className={busy ? 'size-4 animate-spin' : 'size-4'}
        aria-hidden
      />
      {label}
    </Button>
  );
}
