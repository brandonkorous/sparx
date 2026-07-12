// @sparx/web-chrome — shared marketing/site chrome.
//
// The site header (nav + modules megamenu) rendered by both the marketing site
// (apps/web) and the dashboard auth pages (apps/dashboard), so there is one
// header to maintain. Built solely on silicaui (Navbar/NavigationMenu/Drawer/
// Collapsible) + Tailwind utilities — no separate stylesheet to import.

export { SiteHeader, type SiteHeaderProps } from './site-header';
export { ModulesMegaContent, MODULE_GROUPS, MODULE_NAV, type ModuleNavItem } from './modules-menu';
export { getModuleColor, MODULE_COLORS, type MarketingModule } from './module-colors';
