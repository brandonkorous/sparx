# MDI Workbench Specification

## Why MDI stays

Site building, email building, product editing, content editing, live preview, customer research, and stock editing benefit from multiple simultaneous contexts. Piggles should keep that power.

## Customer-facing model

Do not explain "MDI". The customer experiences My Piggles, a workspace, apps, windows/panels, recent, and favorites.

## Required behavior

- multiple app windows
- move and resize
- minimize/restore
- close/reopen
- save and restore layout
- correct focus management
- keyboard navigation
- deep-link to entity
- state retention
- responsive fallback

## Home

Home should answer: **What needs me today?**

Examples:

- 3 orders need attention
- 2 people booked today
- $1,840 waiting to be paid
- 2 products are running low
- 4 customers wrote you

## Intent launcher

Global command/search prompt: **What do you want to do?**

Examples:

- add a product
- change my homepage
- see tomorrow's bookings
- email my customers
- check unpaid invoices

The system should open the appropriate MDI app/window.

## Useful window presets

- Site editor + live preview
- Product + Stock
- Message + Customers
- Invoice + Customer
- Content + Media

## Complexity rule

MDI flexibility should be available without requiring workspace micromanagement. Use sensible defaults and remember state.

## SilicaUI implementation

Use SilicaUI as the visual/behavioral foundation for the workbench wherever appropriate.

The MDI should derive its hierarchy from the active Piggles SilicaUI theme (`light` or `dark`):

- workspace canvas: `base-200`
- normal windows/panes: `base-100`
- recessed/secondary regions: `base-200`
- stronger neutral separation: `base-300`
- normal text/icons: `base-content`
- active/focused branded affordances: `primary`

Prefer SilicaUI primitives/components for shell, sidebar, toolbar, menus, dialogs, command/search, resizable regions, tabs, scroll areas, forms, notifications, and other supported interactions before building custom equivalents.

Custom MDI mechanics may still be required, but their controls should look and behave like the rest of the SilicaUI system.

## Theme persistence

Theme changes must not alter:

- window geometry
- open apps
- active entity
- workspace layout
- favorites
- recent items

Theme preference should persist per user.

If preference is `system`, respond to the OS/browser color-scheme preference without destroying MDI state.
