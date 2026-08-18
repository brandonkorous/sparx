'use client';

// An app's screens: the destinations it exists for, then its sections.
//
// ── WHY THE PANEL SPLITS IN TWO ─────────────────────────────────────────────
//
// The platform registers a module's landing screens with no section, so they
// already arrive as a group — they were simply rendered as the first of many and
// scrolled away with everything else. Sell's Orders sat under seven headings of
// equal weight. They lead now, at full size, and never fold: they are the reason
// the app is on the rail.
//
// ── AND WHY THE REST FOLDS ──────────────────────────────────────────────────
//
// Sell is 40 rows and Stock 39 — two and a half screens of scrolling, in the two
// apps a shop owner lives in. Folded, both are 11 rows and fit with room over.
// The gesture is the one the rail's own groups already teach, so there is
// nothing new to learn, and a folded section carries its count so nothing reads
// as lost.
//
// Quiet sections (`PIGGLES_QUIET_SECTIONS`) start folded AND sort last. Customers
// is why: the platform declares its seven setup screens first, so the app whose
// name is Customers opened on mailboxes and phone systems.

import { faChevronDown } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { SidebarGroup, SidebarItem } from '@wizeworks/silicaui-react';
import { PIGGLES_QUIET_SECTIONS } from '@/lib/console/section-names';
import { sectionKey, setSectionFolded, useSectionChoices } from '@/lib/console/panel-sections';
import type { SurfaceDefinition } from '@/lib/surfaces/registry';
import type { NavSection } from '@/lib/surfaces/nav';
import type { useAttention } from '@/lib/console/home-data';
import type { OpenSurfaces } from '@/lib/console/open-surfaces';
import { sectionWaiting, WaitingBadge } from '@/components/rail/waiting';
import { NavRow, navRowKey } from './nav-row';

type Attention = ReturnType<typeof useAttention>;

interface PanelSectionsProps {
  appId: string;
  sections: NavSection[];
  attention: Attention;
  opened: OpenSurfaces;
  onOpen: (surface: SurfaceDefinition, event: { shiftKey: boolean; altKey: boolean }) => void;
  onCreate: (surface: SurfaceDefinition, event: { shiftKey: boolean; altKey: boolean }) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void;
  /** True while a search is narrowing the list. Everything unfolds, because a
   *  result hidden inside a folded section reads as no result at all. */
  searching: boolean;
}

/** Lead first, then the sections a person works in, then the quiet ones. Sort is
 *  STABLE, so the catalog's editorial order survives inside each band. */
function order(sections: NavSection[]): { lead: NavSection | null; rest: NavSection[] } {
  const lead = sections.find((section) => !section.title) ?? null;
  const rest = sections
    .filter((section) => section.title)
    .map((section, index) => ({ section, index }))
    .sort((a, b) => {
      const quiet = (s: NavSection) => (PIGGLES_QUIET_SECTIONS.has(s.title ?? '') ? 1 : 0);
      return quiet(a.section) - quiet(b.section) || a.index - b.index;
    })
    .map((entry) => entry.section);
  return { lead, rest };
}

export function PanelSections({
  appId,
  sections,
  attention,
  opened,
  onOpen,
  onCreate,
  onKeyDown,
  searching,
}: PanelSectionsProps) {
  const [choices, setChoices] = useSectionChoices();
  const { lead, rest } = order(sections);

  const row = (surface: SurfaceDefinition) => (
    <NavRow
      key={navRowKey(surface)}
      surface={surface}
      attention={attention}
      open={opened.open.has(surface.key)}
      focused={opened.focused === surface.key}
      onOpen={onOpen}
      onCreate={onCreate}
      onKeyDown={onKeyDown}
    />
  );

  const isShut = (title: string): boolean => {
    if (searching) return false;
    const chosen = choices[sectionKey(appId, title)];
    return chosen ?? PIGGLES_QUIET_SECTIONS.has(title);
  };

  return (
    <>
      {/* The destinations. A plain group with no heading — a label over the
          thing the app IS would be an eyebrow (root CLAUDE.md RULE #2). The rule
          below it is the seam between "what you came for" and "everything
          else". */}
      {lead && lead.surfaces.length > 0 ? (
        <div className="border-base-300 mb-1 border-b pb-2">
          <SidebarGroup>{lead.surfaces.map(row)}</SidebarGroup>
        </div>
      ) : null}

      {rest.map((section, index) => {
        const title = section.title ?? '';
        const shut = isShut(title);
        return (
          // The title is not unique across an app that fronts several modules —
          // two of them can each contribute a "Setting it up" — so the key
          // carries the position too.
          <SidebarGroup key={`${title}:${String(index)}`}>
            {/* A SidebarItem, not a SidebarGroupLabel with a button in it: the
                label type is deliberately finer than a row's, so the control you
                click to reveal six screens read as smaller print than the
                screens. Same fix, same reason, as the rail's groups. */}
            <SidebarItem
              className="bg-base-200 sticky top-0 z-10"
              aria-expanded={!shut}
              icon={
                <Icon
                  glyph={faChevronDown}
                  className={`size-4 transition-transform ${shut ? '-rotate-90' : ''}`}
                  aria-hidden
                />
              }
              // What is WAITING inside, never how many rows are in there. A number
              // on a nav row has exactly one job, and a list length in this slot
              // reads identically to a queue (../rail/waiting.tsx). Shown folded
              // AND open, like the rail's own groups: folded because you cannot
              // see the rows, open because a total that disappears when you
              // expand is a different answer to the same question.
              trailing={<WaitingBadge count={sectionWaiting(section.surfaces, attention)} />}
              onClick={() => {
                setChoices(setSectionFolded(appId, title, !shut));
              }}
            >
              {title}
            </SidebarItem>
            {shut ? null : section.surfaces.map(row)}
          </SidebarGroup>
        );
      })}
    </>
  );
}
