# Implementation plan

- `project-board.ts` and board page: one typed query/filter definition for the board and download; preserve authorization in an AND predicate.
- CSV helper/download control: export only the current server-authorized board data (up to 500 shown rows), include scoped project columns and extra details, quote UTF-8 CSV and neutralize formulas. Generate the file locally in the browser; no extra data endpoint is needed.
- Project board client: portal the fixed overlay outside transformed ancestors, constrain preview to viewport, explicit drag handle and touch/mouse sensors, cancel/outside rollback, block overlapping saves and reconcile refreshed props.
- Timeline helpers/journey/detail: clamp chart geometry, contain horizontal scrolling and long text; animate completed stages and bars, replay on demand, honor reduced motion and keep unknown dates unscheduled.
- Manager summary helper/component/page: count all non-archived assigned projects once per person, statuses/completed/remaining/overdue, exclude administrative identities. Retain manager-only route guard.
- Tests/docs: unit checks for CSV, geometry and count semantics; isolated database tests for role/filter/export visibility; production browser tests for pointer/keyboard movement, cancellation, narrow screens, downloads, role boundaries and animation.

Risks: transformed ancestors alter fixed positioning; closest-corner collision alone permits outside drops; shared roster entries can inflate counts; CSV cells can be interpreted as formulas; unknown query scopes must never broaden member access. Synthetic fixtures only. Existing permission grants and version/audit writes remain authoritative on the server.
