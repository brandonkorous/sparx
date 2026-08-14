# Usage Matrix

| Context | Recommended character |
|---|---|
| Login | `laptop` or `desk` |
| Signup intro | `wave` |
| Onboarding start | `wave` |
| Onboarding complete | `celebrate` |
| Generic empty state | `neutral` |
| Search/no results | `thinking` |
| Contextual CTA | `point-left` |
| Bookings onboarding | `calendar` |
| Invoice onboarding | `invoice` |
| First invoice paid | `celebrate` |
| Product published | `celebrate` |
| Help/tip | `thinking` |
| Marketing hero | `desk`, `wave`, or purpose-built scene |
| Footer/brand signature | `neutral` at low emphasis |

## Density

Mascot usage should be intentionally sparse.

Recommended:
- authentication/onboarding: 1 major character per screen
- MDI workbench: mostly contextual empty states and milestone moments
- marketing: 1 major mascot moment every 1–2 major sections at most
- transactional forms: avoid mascot unless it explains/reassures

## Accessibility

Decorative mascot:
```html
<img src="..." alt="" />
```

Meaningful mascot:
Use the manifest-provided alt text or context-specific equivalent.

Never use the mascot as the only indicator of success, warning, or error.
