'use client';

// One record type: its name and the extra details this business tracks on it
// (docs/144 §3). `{ key: 'new' }` invents one, `{ key }` manages one: same shape.
// Explicit save, one button, last-write-wins; nothing is written until Save.

import { PaneWaiting } from '../../components/pane-waiting';
import { PaneLoadError } from '../../components/pane-load-error';
import { faBoxes } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { PANE_SHELL } from '../../components/pane-toolbar';
import { useObjectTypeEditor } from './use-object-type-editor';
import { ObjectTypeToolbar } from './object-type-toolbar';
import { ObjectTypeNameSection } from './object-type-name-section';
import { ObjectTypeFieldsSection, ObjectTypePrimarySection } from './object-type-fields-section';

export function ObjectTypeDetailSurface({ ctx }: { ctx: SurfaceContext }) {
  const ed = useObjectTypeEditor(ctx);
  const { isNew, isBuiltin, draft, loaded } = ed;
  const { isPending, isError, error, refetch } = ed.query;

  // Removed and unreachable are different fixes (sparx persona issue 243).
  if (!isNew && isError) {
    return (
      <div className={PANE_SHELL}>
        <PaneLoadError
          icon={<Icon glyph={faBoxes} className="size-6" aria-hidden />}
          error={error}
          noun="thing you track"
          title="Could not open this thing you track"
          description="This is a problem reaching the server. The things you track are unaffected. Try again in a moment."
          onRetry={() => {
            void refetch();
          }}
        />
      </div>
    );
  }

  if (!loaded || (!isNew && isPending)) {
    return (
      <div className={PANE_SHELL}>
        <PaneWaiting />
      </div>
    );
  }

  return (
    <div className={PANE_SHELL}>
      <ObjectTypeToolbar ed={ed} />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4">
          <ObjectTypeNameSection ed={ed} />
          <ObjectTypeFieldsSection ed={ed} />
          {!isBuiltin && draft.fields.length > 0 ? <ObjectTypePrimarySection ed={ed} /> : null}
        </div>
      </div>
    </div>
  );
}
