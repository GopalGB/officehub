# Personas — who uses OfficeHub

> **Why this doc exists.** Every product decision in OfficeHub — especially drag-and-drop and the role/permission model — has to work for thousands of distinct user situations. This file is the matrix we design against. It is **not** a roster of fake users; it is a structured persona space that informs:
>
> 1. Which account types exist and why
> 2. Which device, dexterity, and tenure constraints we must respect
> 3. Which Kanban gestures map to which user groups
> 4. Why certain "obvious" Jira/Notion patterns are wrong for the long tail
>
> The named archetypes (Section 4) are illustrative. The full matrix (Section 5) enumerates 1024 distinct persona slots derived from the dimensions in Section 2. Designers and AI agents must consult Section 6 (DnD requirements derived from personas) before touching the board components.

---

## 1. Account types (the role model OfficeHub ships)

OfficeHub uses **three core roles** + **two project-scoped overlays**. The three roles are global (set in `User.role`); the two overlays are computed per-project from membership.

| Tier | Global role | Project overlay | Real-world example |
|---|---|---|---|
| 1 | **ADMIN** | — | Founder, IT lead, head of ops. 1–3 per company. Full read/write everywhere, including user management. |
| 2 | **MANAGER** | — | Team lead, project lead, dept head. 1–2 per team. Reads everything, writes any project, cannot manage users. |
| 3 | **MEMBER (Project Owner)** | OWNER | The person who created the project. Full edit on their projects + can change member roster. |
| 3 | **MEMBER (Project Collaborator)** | COLLABORATOR | A MEMBER explicitly added to a project's roster. Edit access on that project; cannot change the roster. |
| 3 | **MEMBER (Outsider)** | — | A MEMBER for whom the project is invisible (not owner, not on roster, not MANAGER+). |

**Roadmap roles** (not shipped yet, but the persona matrix anticipates them — see `docs/ROADMAP.md`):

| Tier | Role | Why we'll add it |
|---|---|---|
| 4 | **VIEWER** | Stakeholders, clients, exec observers. Read-only across allowed scope. Today this is faked by "give them a MEMBER account + don't add them to anything." |
| 5 | **GUEST** | External collaborator with single-project access. Today this is faked by per-project MEMBER + manual cleanup. |
| 6 | **BILLING_ONLY** | Finance contact who only sees the billing tab. Today this is a manual workaround. |

Permission detail lives in [`ROLES.md`](./ROLES.md); this file focuses on **who** uses the roles, not which buttons each role can click.

---

## 2. Persona dimensions

We model every persona along **six independent dimensions**. The Cartesian product is the persona space.

### 2.1 Role (5 values)
`ADMIN`, `MANAGER`, `MEMBER_OWNER`, `MEMBER_COLLAB`, `VIEWER_FUTURE`.

### 2.2 Org size (4 values, log-scaled)
`Solo` (1 person), `Tiny` (2–15), `Mid` (16–100), `Large` (101+).

### 2.3 Industry vertical (16 values)
Software, Marketing Agency, Design Studio, Consulting, Legal, Accounting, Sales, Customer Success, HR, Finance, Operations, Real Estate, Healthcare, Education, Non-Profit, Construction.

Each industry inherits a default "what we put on a card":

| Industry | What a Project is | What a Task is |
|---|---|---|
| Software | A feature, epic, sprint | A user story, bug |
| Marketing Agency | A campaign | A deliverable (creative, copy, ad) |
| Design Studio | A client brief | A mockup, revision |
| Consulting | An engagement | A workstream |
| Legal | A matter / case | A filing, motion |
| Accounting | A client period | A return, reconciliation |
| Sales | A deal | A call, follow-up |
| Customer Success | An account | A health-check, renewal task |
| HR | A hire / program | An interview, training session |
| Finance | A close cycle / audit | A reconciliation, journal entry |
| Operations | A vendor / contract | An SLA check, renewal |
| Real Estate | A property / deal | A showing, closing step |
| Healthcare | A patient case / claim | An appointment, lab follow-up |
| Education | A course / cohort | A lesson, grading task |
| Non-Profit | A program / grant | A donor outreach, report |
| Construction | A project / site | An inspection, change order |

### 2.4 Device profile (4 values)
- `Desktop` — keyboard + mouse, 13"+ screen
- `Mobile` — phone-first; sales reps in the field, executives commuting
- `Tablet` — review-heavy use (designers, execs); long-press is the dominant gesture
- `A11y` — screen reader and/or keyboard-only

### 2.5 Tenure (4 values)
- `D1` — first 24 hours; clueless about UI conventions
- `D7` — first week; knows the basics
- `D30` — comfortable; uses keyboard shortcuts
- `D365` — power user; expects undo, multi-select, bulk ops

### 2.6 Dexterity / cognition (2 values)
- `Standard` — typical motor + cognitive ability
- `Constrained` — Parkinson's, RSI, tremor, low vision, cognitive load (covers WCAG AA tier)

Total slots: `5 × 4 × 16 × 4 × 4 × 2 = 10,240` distinct personas.
The appendix (Section 5) materializes 1024 of them as named tuples.

---

## 3. The five mental models a user brings (UX archetypes)

Independent of role, every user shows up with one of five mental models for how a Kanban board "should" work. We design for all five.

| Archetype | Quote | Implication for DnD |
|---|---|---|
| **Notion native** | "I expect block-level drag handles with a `⠿` icon on hover." | Drag handle visible on row hover; full card is also draggable. |
| **Jira native** | "I expect cards I can throw across columns with a blue insertion line." | Cross-column drop is the default; insertion indicator between cards. |
| **Trello native** | "I expect to grab anywhere on a card." | Whole-card drag (not just header). |
| **Spreadsheet native** | "What is a Kanban?" | An always-visible 'Move to' menu next to drag; keyboard arrows must work. |
| **Mobile native** | "I tap and slide." | Long-press to lift; haptic feedback on grab and drop. |

---

## 4. Named archetypes (50 illustrative examples)

These are not customers; they are crystallizations of the matrix. Each named persona pins specific cells in the matrix and informs a concrete UX rule.

> Naming convention: `First-name (role / industry / size / device / tenure / dexterity)`. Each line links a persona to a concrete UX requirement we ship for them.

### 4.1 ADMIN cluster

1. **Priya** (ADMIN / Software / Mid / Desktop / D365 / Standard) — moves dozens of cards per day. Needs **keyboard shortcuts** and **multi-select drag**.
2. **Jamal** (ADMIN / Marketing Agency / Tiny / Laptop / D30 / Standard) — runs the whole agency from a 13" MacBook Air. **Compact card density** matters.
3. **Hiroshi** (ADMIN / Construction / Large / Tablet / D90 / Standard) — reviews from job sites. **Touch + long-press grab** is the dominant gesture.
4. **Elena** (ADMIN / Healthcare / Mid / Desktop / D1 / Constrained) — voice-control user. **Move-via-keyboard alternative** must be discoverable.
5. **Marcus** (ADMIN / Legal / Solo / Desktop / D7 / Standard) — solo practitioner; one user, everything in their head. **Single-column 'My Day' view** must exist.

### 4.2 MANAGER cluster

6. **Saanvi** (MANAGER / Software / Mid / Desktop / D365 / Standard) — sprint master. Drags 20–50 cards every Monday during grooming. **Bulk reorder + undo** required.
7. **Rohan** (MANAGER / Marketing Agency / Tiny / Mobile / D30 / Standard) — checks queue on the train. **Mobile cards must be reorderable with long-press**.
8. **Chen** (MANAGER / Consulting / Mid / Desktop / D90 / Standard) — week-aligned mental model. **"This week" filter + drag** must persist.
9. **Faith** (MANAGER / Non-Profit / Tiny / Laptop / D7 / Constrained) — older hands, mild tremor. **Drag activation distance must be ≥5px** to avoid accidental grabs.
10. **Tomás** (MANAGER / Healthcare / Mid / Desktop / D30 / Standard) — needs a HIPAA-style audit trail. **Every move must be logged** with actor + timestamp.

### 4.3 MEMBER_OWNER cluster

11. **Anika** (MEMBER_OWNER / Software / Tiny / Desktop / D365 / Standard) — owns 6 projects. Drags own cards freely; cannot drag teammates'. **Lock indicator on others' cards**.
12. **Diego** (MEMBER_OWNER / Design Studio / Solo / Tablet / D30 / Standard) — touch-first. **2-finger scroll, 1-finger drag** mapping required.
13. **Priscilla** (MEMBER_OWNER / Real Estate / Tiny / Mobile / D7 / Standard) — pipeline in pocket. **Status-only quick-move via tap on pill** as drag fallback.
14. **Olu** (MEMBER_OWNER / Legal / Solo / Desktop / D90 / Constrained) — keyboard-only. **Tab to card, Space to grab, arrows to move, Space to drop**.
15. **Kai** (MEMBER_OWNER / Education / Tiny / Laptop / D30 / Standard) — runs a cohort. **Drag a card from In-Review to Done announces "Task X moved to Done"** via screen reader.

### 4.4 MEMBER_COLLAB cluster

16. **Layla** (MEMBER_COLLAB / Marketing Agency / Mid / Desktop / D30 / Standard) — junior writer. Drags her assignments only. **`isDragDisabled` for cards she doesn't own/assign-to**, but pill click still works.
17. **Yusuf** (MEMBER_COLLAB / Software / Mid / Desktop / D7 / Standard) — new hire. **Tooltip on first hover of locked card explains why** it's locked.
18. **Sasha** (MEMBER_COLLAB / Customer Success / Mid / Mobile / D30 / Standard) — on the phone with customers; phone in hand. **Drag must not steal scroll** — touchAction CSS rules.
19. **Reese** (MEMBER_COLLAB / Finance / Mid / Desktop / D365 / Standard) — month-end close. Drags cards under time pressure; **must not flicker or jump**.
20. **Nia** (MEMBER_COLLAB / HR / Tiny / Laptop / D1 / Standard) — Day 1. **Help text on the board must explain the gestures** in one line.

### 4.5 MEMBER_OUTSIDER cluster

21. **Trevor** (MEMBER / Software / Mid / Desktop / D90 / Standard) — assigned a one-off task by a manager. Sees the task but not the project. **Cannot drag the project card** but can drag the task card.

### 4.6 Cross-industry edge cases

22. **Amelia** (MEMBER_OWNER / Restaurant chain (Ops sub-industry) / Large / Tablet / D30 / Standard) — runs 40 locations. Drag must work with a glove.
23. **Bishop** (ADMIN / Non-Profit / Tiny / Desktop / D365 / Standard) — annual grant cycle; column "Awarded" hits a WIP limit of 1. **WIP-limit warning on drop**.
24. **Carmen** (MANAGER / Sales / Mid / Mobile / D30 / Standard) — pipeline view; drags Won/Lost daily. **Confetti animation on Won column** (Trello/Jira-style).
25. **Devansh** (MEMBER_OWNER / Manufacturing (Ops) / Mid / Desktop / D90 / Standard) — production line; reorders within a column constantly to set priority. **Within-column drag with explicit position** is the killer gesture.
26. **Esi** (MEMBER_COLLAB / Education / Mid / Tablet / D7 / Constrained) — visually impaired student-affairs counselor. **Drag overlay must keep ARIA-live narration** while dragging.
27. **Farhan** (MEMBER_OWNER / Construction / Tiny / Desktop / D365 / Standard) — winter site shutdowns; archives 30 cards in one go. **Multi-select + drag-to-Archive** is required.
28. **Gabi** (MEMBER_COLLAB / Healthcare / Mid / Mobile / D7 / Standard) — covers night shift. Drags from BLOCKED → IN_REVIEW at 2am. **Dark-mode-suppressed pure white theme** must not blind her — `prefers-color-scheme: dark` SHOULD switch but the project policy says pure white only; we ship a "Dim screen" preference instead.
29. **Hans** (MANAGER / Real Estate / Mid / Desktop / D365 / Constrained) — Parkinson's; activationDistance must be 8–10px, not the default 5px. **Per-user `dragActivationDistance` setting** (future).
30. **Iyana** (MEMBER_OWNER / Sales / Solo / Mobile / D90 / Standard) — single-person business. Cards are deals. **Currency formatting in card metadata** (future).

### 4.7 Power-user expectations

31. **Joon** (MANAGER / Software / Large / Desktop / D365 / Standard) — sprint planner. Expects **Cmd+Z undo, Cmd+Shift+Z redo**.
32. **Karina** (ADMIN / Operations / Large / Desktop / D365 / Standard) — vendor renewal pipeline. Expects **a "Move to..." right-click menu** in addition to drag.
33. **Liam** (MANAGER / Marketing Agency / Mid / Desktop / D365 / Standard) — keyboard-first. Expects **`j`/`k` to move card focus, `m` to enter Move mode**.
34. **Mei** (MEMBER_OWNER / Design Studio / Tiny / Desktop / D365 / Standard) — color-coded brain. Expects **priority color stays visible during drag** (we ship a Priority bar).
35. **Noah** (MEMBER_OWNER / Software / Mid / Desktop / D365 / Standard) — uses two displays. Drag must work **across full window even on 4K**.

### 4.8 Constrained-dexterity / a11y critical

36. **Ola** (MEMBER_OWNER / Legal / Solo / A11y / D30 / Constrained) — JAWS screen reader. **Live region must announce: "Picked up card X from column TODO. Now in column IN_PROGRESS, position 3 of 7. Press Space to drop."**
37. **Pat** (MEMBER_COLLAB / Education / Mid / A11y / D7 / Constrained) — switch device user. Must reach every drag target via **single-switch sequential scan**.
38. **Quinn** (MEMBER_OWNER / Marketing Agency / Solo / A11y / D365 / Constrained) — voice control via Dragon. **Cards must have unique accessible names** (`aria-label="Move card: Q4 launch — currently in Planning"`).
39. **Rin** (MEMBER_OWNER / Software / Tiny / Desktop / D30 / Constrained) — low vision. **DragOverlay must respect `prefers-contrast: more`** (we ship a 2px black border).
40. **Sven** (MANAGER / Construction / Mid / Tablet / D365 / Constrained) — gloved, in cold. **Activation must trigger on intentional press, not jitter** — 8px movement threshold.

### 4.9 Mobile-specific

41. **Tara** (MEMBER_OWNER / Real Estate / Solo / Mobile / D7 / Standard) — touchstart inside a scrollable column; must not trigger drag immediately. **Long-press 300ms + 5px movement** before drag begins.
42. **Uma** (MEMBER_COLLAB / Sales / Tiny / Mobile / D30 / Standard) — fast-moving. Wants **swipe-to-status** as a board alternative (future).
43. **Vihaan** (MEMBER_OWNER / Healthcare / Tiny / Mobile / D90 / Standard) — orientation-changing. Drag must survive landscape↔portrait flip.
44. **Wren** (MEMBER_COLLAB / Customer Success / Mid / Tablet / D30 / Standard) — Apple Pencil. **Pencil tap must be treated as pointer, not touch.**
45. **Xander** (MEMBER_OWNER / Operations / Solo / Mobile / D1 / Standard) — never used a Kanban board. **First-run tutorial overlay** is non-negotiable.

### 4.10 Day 1 / onboarding

46. **Yara** (MEMBER / Legal / Tiny / Desktop / D1 / Standard) — first day on the job. **The default board view must work without onboarding** — the gestures must be discoverable.
47. **Zane** (MEMBER_COLLAB / Marketing Agency / Mid / Desktop / D1 / Standard) — sees a board for the first time. **Empty columns must show "Drop a card here" hint**.
48. **Aarav** (MEMBER_OWNER / Software / Solo / Desktop / D1 / Constrained) — keyboard learner. **Tab-and-Space gesture must be hinted on the first locked-out drag attempt**.
49. **Beatrix** (MANAGER / Non-Profit / Tiny / Mobile / D1 / Constrained) — older volunteer. **Drag UX should never punish a slow gesture** — no auto-revert if user holds for >2s.
50. **Cyrus** (ADMIN / Sales / Solo / Desktop / D7 / Standard) — solo founder doing their first sprint planning. **Undo via toast within 5 seconds** of a drag.

---

## 5. The 1024-row materialized matrix (appendix)

Generated by `scripts/generate-personas.ts` from the dimensions above. Each row is a single persona slot. We do **not** name all 1024 — naming is a distraction. Rows are tuples `(role, size, industry, device, tenure, dexterity)` keyed by integer ID.

See [`PERSONAS-APPENDIX.md`](./PERSONAS-APPENDIX.md) for the full table. Total rows: **1024**. Spot-check: row 512 = `MEMBER_COLLAB / Tiny / Customer Success / Mobile / D30 / Standard` → maps to "Sasha-class" (persona #18).

To regenerate:
```bash
npx tsx scripts/generate-personas.ts > docs/PERSONAS-APPENDIX.md
```

---

## 6. DnD requirements derived from the persona matrix

Every requirement below is owed to one or more persona clusters. The "owed to" column is how we prevent feature creep — if no persona demands it, we don't build it.

| # | Requirement | Owed to |
|---|---|---|
| 1 | **Cross-column drag** | All Jira-native users; Saanvi, Rohan, Carmen, Joon, Liam |
| 2 | **Within-column reorder** | Devansh (priority reordering), Saanvi (sprint grooming) |
| 3 | **PointerSensor** with 5px activation | Faith (tremor), Anika (mouse precision) |
| 4 | **TouchSensor** with 300ms delay + 5px tolerance | Tara, Sasha, Rohan (mobile) |
| 5 | **KeyboardSensor** with sortableKeyboardCoordinates | Olu, Pat, Ola, Aarav (keyboard-only) |
| 6 | **ARIA live announcements** on pick/drop/cancel | Ola, Esi, Pat, Quinn (screen reader) |
| 7 | **Drop-zone visual feedback** (column ring change) | Yara, Zane, Cyrus (Day 1) |
| 8 | **DragOverlay** with rotation + scale + shadow | Jira/Trello-native expectations |
| 9 | **Lock indicator on disallowed cards** | Anika, Yusuf, Trevor (RBAC clarity) |
| 10 | **Empty-column "Drop here" hint** | Zane, Yara (Day 1) |
| 11 | **WIP limit warning on overflow** | Bishop (grant pipeline) |
| 12 | **Auto-scroll near viewport edge** | Saanvi, Joon (long columns) |
| 13 | **Optimistic UI with revert on server error** | All (latency hiding) |
| 14 | **Concurrent-move conflict detection** | Joon, Karina (multi-user teams) |
| 15 | **Touch-action: none** on cards | Sasha, Vihaan (mobile scroll isolation) |
| 16 | **Pure white theme during drag** | Project policy; Mei (color-coded brain) — priority bar must remain visible |
| 17 | **Status-pill fallback** for non-drag users | Priscilla, Pat, Ola (mobile + a11y) |
| 18 | **Card stays clickable after drag** (link to detail) | All — drag and click must coexist |
| 19 | **No drag steals click** — 5px activation distance | Faith, Hans (tremor); Mei (precision) |
| 20 | **Multi-select + bulk drag** (future v2.x) | Farhan (mass archive), Joon (sprint planning) |
| 21 | **Undo via toast** within 5s of drop | Cyrus, Saanvi (mistake recovery) |
| 22 | **Swimlanes by assignee** (future v2.x) | Carmen (sales pipeline view) |
| 23 | **Card position persisted** via Float `orderIndex` | All — drag must survive refresh |
| 24 | **Server-side RBAC re-check** on every move | All — security; Trevor (outsider lock-down) |

Items 1–19, 23, 24 ship in v2.2 (this PR).
Items 20–22 are explicit v2.x backlog.

---

## 7. What this doc forbids

To stop feature creep, we explicitly forbid the following design moves unless a new persona is added with a clear unmet need:

- **No drag-to-delete** (Trello does it; deleted Trello cards are notorious). A drag is a *re-categorization*, never a destructive act.
- **No keyboard shortcut shadowing of browser** (`Cmd+W`, `Cmd+T`, etc.).
- **No color-only state cues** (WCAG; the persona matrix includes constrained-dexterity users).
- **No drag-and-drop in dense tables** unless the row has a dedicated grab affordance. Whole-row drag in tables causes accidental moves.
- **No animated card-to-card swap** longer than 200ms. Beyond that, motion-sensitivity users get distracted (matrix Constrained tier).

---

## 8. Version

v1.0 · 2026-05-28 · informs v2.2 drag-and-drop rebuild
