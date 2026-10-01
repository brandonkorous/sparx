'use client';

// What one site shows, and the two rare, hard-to-undo moves at the bottom of it.
//
// Making a site primary and deleting one are both rare and both hard to undo. As
// full cards in a rail they carried the same weight as the settings someone
// actually came here to change, which is how a destructive button becomes
// something you click by habit. They live at the bottom now, after the work.

import { useMemo } from 'react';
import { Button, Checkbox, Text } from '@wizeworks/silicaui-react';
import { faStar, faTrashCan } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { FormSection } from '../../components/form-section';
import type { Site } from './data';
import { moduleLabel } from '../../lib/surfaces/nav';
import type { WorkbenchModule } from '../../components/module-scope';

/** Modules a site can be told not to show. `builder` is absent on purpose — it
 *  is what BUILDS the site, so hiding it from one site is meaningless. */
const SCOPEABLE = ['commerce', 'cms', 'crm', 'email', 'b2b', 'dropship', 'inventory', 'ai'];

// The names come from `lib/surfaces/nav.ts`, which resolves them through the
// brand's app registry. This file kept its own, saying "Selling", "Email", "AI"
// and "Inventory" for apps the rail calls Sell, Messages, Connections and Stock.
// One of six such tables; see the note in nav.ts.

export function SiteScope({
  site,
  enabledModules,
  saving,
  onToggle,
}: {
  site: Site;
  enabledModules: string[];
  saving: boolean;
  onToggle: (slug: string, visible: boolean) => void;
}) {
  // Only modules the ACCOUNT has switched on can be scoped — a switch for
  // something the business does not have would promise a capability it cannot
  // deliver, and turning it "on" here would still show nothing.
  const available = useMemo(() => {
    const enabled = new Set(enabledModules);
    return SCOPEABLE.filter((slug) => enabled.has(slug));
  }, [enabledModules]);

  return (
    <FormSection
      title="What this site shows"
      // "Saved as you switch them" because this card does NOT wait for the Save
      // button sitting at the top of the same screen, and the Site name field
      // above it does. Two save models on one page with nothing saying which is
      // which leaves a person guessing whether their change took.
      description="Switch off anything this site has no use for. It stays available on your other sites. Saved as you switch them."
    >
      {available.length === 0 ? (
        <Text className="text-sm">
          Nothing to choose yet. This account has no other apps switched on beyond My Site itself.
        </Text>
      ) : (
        available.map((slug) => (
          <label key={slug} className="flex items-center gap-2">
            <Checkbox
              color="module"
              checked={!site.moduleScope.includes(slug)}
              disabled={saving}
              aria-label={moduleLabel(slug as WorkbenchModule)}
              onChange={(event) => {
                onToggle(slug, event.target.checked);
              }}
            />
            <Text as="span">{moduleLabel(slug as WorkbenchModule)}</Text>
          </label>
        ))
      )}
    </FormSection>
  );
}

export function SiteRareMoves({
  site,
  promoting,
  deleting,
  onMakePrimary,
  onDelete,
}: {
  site: Site;
  promoting: boolean;
  deleting: boolean;
  onMakePrimary: () => void;
  onDelete: () => void;
}) {
  if (site.isPrimary) {
    return (
      <div className="border-base-300 flex flex-col gap-3 border-t pt-4">
        <Text className="text-sm">
          This is your primary site: the one that answers your account&apos;s main web address. Make
          another site primary to move that role, which is also what has to happen before this one
          can be deleted.
        </Text>
      </div>
    );
  }

  return (
    <div className="border-base-300 flex flex-col gap-3 border-t pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Text className="text-sm">
          Make this the primary site to point your account&apos;s main address here. The current
          primary keeps its own address.
        </Text>
        <Button
          size="sm"
          variant="outline"
          color="module"
          disabled={promoting}
          onClick={onMakePrimary}
        >
          <Icon glyph={faStar} className="size-4" aria-hidden />
          {promoting ? 'Working…' : 'Make primary'}
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Text className="text-sm">
          Deleting this site removes its pages, layouts, forms and web addresses. This cannot be
          undone.
        </Text>
        <Button size="sm" variant="outline" color="danger" disabled={deleting} onClick={onDelete}>
          <Icon glyph={faTrashCan} className="size-4" aria-hidden />
          {deleting ? 'Deleting…' : 'Delete this site'}
        </Button>
      </div>
    </div>
  );
}
