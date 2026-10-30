# Plan

- Global CSS / branding guidance: consistent light Catalyst surfaces, focus states,
  semantic status accents, and accessible native disclosure styling.
- Sidebar / mobile navigation: remove duplicate import and board destinations;
  keep both reachable from Projects and highlight Projects on board routes.
- Projects / board / cards: common view switch, compact headers and filters,
  clearer status colors, fewer metadata lines.
- Project detail: Overview, Work, History; keep old details/reports/enhancements/
  activity URLs working. Group secondary fields into disclosures; preserve actions.
- Journey: animated stage progress first, dated schedule and filters on demand.
- Project form: basics visible; optional metadata grouped, reveal invalid fields.
- Team overview: compact per-person counts with optional breakdown and portfolio.

Risks: hidden invalid fields, legacy timeline links, lost form values, and mobile
horizontal overflow. Verify these in Chromium with synthetic data and roles.
Run existing unit / integration tests, lint, strict TypeScript, and production
build. Check board dragging and authorized CSV export still work. No style-only
mirror tests; use rendered behavior for these changes.
