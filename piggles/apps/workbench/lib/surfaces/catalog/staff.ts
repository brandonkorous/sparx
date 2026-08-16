// Your team — the people who do the work (docs/149).
//
// Six surfaces, and the grouping says what the module is FOR. "Who works here"
// is the roster and their qualifications; "Hours and pay" is the part that
// reaches the ledger; "Planning" is the rota, which deliberately does not.
//
// GATING is uniform — every surface here requires the `staff` module, and that
// is the default (`requiresModules` is absent), so nothing needs to say so.
// Unlike finance there is no free half: a roster is not a lens over data another
// module produced, it is this module's own record. There is no bundling in
// either direction with finance either — staff makes finance's wages line
// accurate, but neither is included with the other (docs/149 §2).
//
// Timesheets is the one surface an ordinary editor cannot open: it shows what
// each person's hours COST, which is their pay rate with one division undone.
// api-rest enforces that with a 403 and the surface explains the refusal rather
// than rendering an empty grid — the catalog cannot express a per-ROLE gate, and
// hiding the row entirely would leave an admin unable to find the screen from
// the launcher.

import {
  faAddressBook,
  faCalendarDays,
  faCalendarXmark,
  faClipboardClock,
  faShieldCheck,
} from '@fortawesome/pro-solid-svg-icons';
import type { SurfaceDefinition } from '../registry';
import { PeopleSurface } from '../../../surfaces/staff/people';
import { PersonSurface } from '../../../surfaces/staff/person';
import { TimesheetsSurface } from '../../../surfaces/staff/timesheets';
import { ScheduleSurface } from '../../../surfaces/staff/schedule';
import { TimeOffSurface } from '../../../surfaces/staff/time-off';
import { CertificationsSurface } from '../../../surfaces/staff/certifications';

export const STAFF_SURFACES: SurfaceDefinition[] = [
  {
    key: 'staff.people',
    title: 'People',
    module: 'staff',
    icon: faAddressBook,
    component: PeopleSurface,
    order: 1,
    createSurface: 'staff.person',
    createLabel: 'Add someone',
    keywords: ['staff', 'team', 'employees', 'crew', 'roster', 'who works here', 'contractors'],
  },
  {
    key: 'staff.person',
    title: (params) => (params.id === 'new' ? 'New person' : 'Person'),
    module: 'staff',
    icon: faAddressBook,
    component: PersonSurface,
    // Reached from the roster or the `+`. Opening "a person" with nobody in mind
    // is not a thing anyone wants.
    listed: false,
  },

  /* ── Hours and pay — the half that reaches the ledger ───────────────────── */
  {
    key: 'staff.timesheets',
    title: 'Timesheets',
    module: 'staff',
    icon: faClipboardClock,
    component: TimesheetsSurface,
    singleton: true,
    section: 'Hours and pay',
    order: 10,
    keywords: [
      'timesheet',
      'hours',
      'approve',
      'clock',
      'wages',
      'labour cost',
      'labor cost',
      'what did the week cost',
    ],
  },

  /* ── Planning — nothing here reaches the ledger ─────────────────────────── */
  {
    key: 'staff.schedule',
    title: 'Schedule',
    module: 'staff',
    icon: faCalendarDays,
    component: ScheduleSurface,
    singleton: true,
    section: 'Planning',
    order: 20,
    keywords: ['rota', 'shifts', 'who is on', 'week', 'cover', 'scheduling staff'],
  },
  {
    key: 'staff.timeoff',
    title: 'Time off',
    module: 'staff',
    icon: faCalendarXmark,
    component: TimeOffSurface,
    singleton: true,
    section: 'Planning',
    order: 21,
    keywords: ['holiday', 'vacation', 'leave', 'sick', 'absence', 'requests', 'away'],
  },

  /* ── Compliance ─────────────────────────────────────────────────────────── */
  {
    key: 'staff.certifications',
    title: 'Tickets and licences',
    module: 'staff',
    icon: faShieldCheck,
    component: CertificationsSurface,
    singleton: true,
    section: 'Compliance',
    order: 30,
    keywords: [
      'certifications',
      'licences',
      'licenses',
      'tickets',
      'expiring',
      'renewals',
      'qualifications',
      'cdl',
      'insurance',
    ],
  },
];
