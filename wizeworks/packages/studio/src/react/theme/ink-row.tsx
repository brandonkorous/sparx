'use client';

// The words that sit ON a color.
//
// silica picks one by measured contrast when the theme sets none, and that is a
// RECOMMENDATION — the author can overrule it, because cream on a deep green is a
// brand decision and no contrast formula is going to arrive at it. So the row
// says which of the two is in force, and offers the way back to automatic.
//
// The picker OPENS on the recommendation rather than on nothing, so a first nudge
// starts from the sensible answer instead of from an unrelated default.

import { useThemeEdit } from './edit-context';
import { ColorValue } from './color-tile';
import { ResetToken } from './reset-token';

export function InkRow({
  contentToken,
  label,
  recommended,
}: {
  contentToken: string;
  label: string;
  recommended: string | undefined;
}) {
  const { values, editable, setToken } = useThemeEdit();
  const authored = values[contentToken];
  const name = `Text on ${label.toLowerCase()}`;

  return (
    <div className="mt-2 flex items-center gap-3 pl-1">
      <ColorValue
        label={name}
        value={authored ?? recommended}
        disabled={!editable}
        onChange={(next) => setToken(contentToken, next, `Set ${name}`)}
      />
      <div className="min-w-0 flex-1">
        <p className="text-base-content text-sm">
          {authored ? `${name} — yours` : `${name} — chosen for legibility`}
        </p>
      </div>
      <ResetToken token={contentToken} label={name} automatic />
    </div>
  );
}
