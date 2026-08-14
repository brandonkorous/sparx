# Theme QA

Piggles ships with `light` and `dark`.

## Required QA matrix

Validate every major surface in both themes:

- marketing-to-auth transitions
- onboarding
- MDI workspace
- active/inactive windows
- navigation
- dialogs
- menus
- forms
- tables
- builders/editors
- site preview chrome
- email builder
- product editor
- content editor
- customer views
- booking views
- invoice views
- money/reporting
- notifications/toasts
- empty states
- loading states
- error states
- settings
- billing/account surfaces

## Theme switching

Test:

- light → dark
- dark → light
- system → OS light
- system → OS dark
- OS preference change while app is open

Expected:

- no workspace reset
- no window movement
- no form-data loss
- no focus loss
- no unreadable transition flash
- no incorrect persisted explicit preference

## Visual regression

Maintain light and dark visual regression snapshots for core shell and highest-value workflows.
