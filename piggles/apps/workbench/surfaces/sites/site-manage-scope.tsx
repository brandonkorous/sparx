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

/** Modules a site can be told not to show. `builder` is absent on purpose — it
 *  is what BUILDS the site, so hiding it from one site is meaningless. */
const SCOPEABLE = ['commerce', 'cms', 'crm', 'email', 'b2b', 'dropship', 'inventory', 'ai'];

const MODULE_LABELS: Record<string, string> = {
  commerce: 'Selling',
  cms: 'Content',
  crm: 'Customers',
  email: 'Email',
  b2b: 'Wholesale',
  dropship: 'Dropshipping',
  inventory: 'Inventory',
  ai: 'AI',
};

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
      description="Switch off anything this site has no use for. It stays available on your other sites."
    >
      {available.length === 0 ? (
        <Text className="text-sm">
          Nothing to choose yet — this account has no modules switched on beyond the site builder
          itself.
        </Text>
      ) : (
        available.map((slug) => (
          <label key={slug} className="flex items-center gap-2">
            <Checkbox
              color="module"
              checked={!site.moduleScope.includes(slug)}
              disabled={saving}
              aria-label={MODULE_LABELS[slug] ?? slug}
              onChange={(event) => {
                onToggle(slug, event.target.checked);
              }}
            />
            <Text as="span">{MODULE_LABELS[slug] ?? slug}</Text>
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
          This is your primary site — the one that answers your account&apos;s main web address.
          Make another site primary to move that role, which is also what has to happen before this
          one can be deleted.
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
