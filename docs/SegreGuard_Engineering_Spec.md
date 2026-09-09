# SegreGuard — Engineering Specification & Build Backlog
### For handoff to an AI coding agent (e.g. Claude Code)

This document is written to be pasted into an AI coding agent almost as-is. It assumes the agent will build iteratively, checking off tasks in order, and asking the human only when a decision is explicitly flagged below as "confirm with team."

---

## 0. Kickoff prompt (paste this first, then paste the rest of the doc as reference)

> Build SegreGuard, a mobile-first web app for AI-assisted biomedical-waste segregation and traceability, following the spec below. Work in vertical slices, not layer-by-layer — after each task, the app should still run end to end. Start with Milestone 0, confirm it runs, then proceed task by task through the milestones in order. Use the swappable-classifier pattern from Epic 6 so the app works with a mock AI from the very first milestone, and only needs a config flip to use a real model later. Flag anything marked "confirm with team" instead of guessing. Optimize for a working, demoable product over completeness — an unfinished Epic 8 is fine, a broken Epic 2 is not.

---

## 1. Product summary (context for the agent)

SegreGuard has two connected parts:
1. **Live Segregation Assistant** — a healthcare worker points a camera at biomedical waste; the app classifies it against India's Bio-Medical Waste Management Rules 2016 (Schedule I: Yellow / Red / White-sharps / Blue), shows the correct bin with a confidence score, and — critically — explicitly says "unable to confidently identify, manual verification required" rather than guessing when confidence is low.
2. **Waste Lifecycle & Traceability Platform** — every classification event is logged; collection workers see pickup tasks; hospital admins see a live dashboard, bin fill levels, and alerts.

Full product rationale, regulatory grounding, and honest scope framing already exist in the team's planning doc (`SIH2026_PS26115_Project_Documentation.md`) — this spec turns that into buildable work. The agent does not need to re-derive product decisions already made there.

---

## 2. Software process model

**Model: Kanban-style, milestone-gated, vertical-slice delivery.** Not Scrum (no value in ceremonies for a single AI-agent-driven build), not waterfall (no time to fully spec before building), and not pure TDD (time-boxed — write tests only where specified below).

Rules for the agent:
- Work one **milestone** at a time, in order. Do not start Milestone N+1 until Milestone N runs end-to-end.
- Within a milestone, work one **epic task** at a time, in the listed order.
- After each task, the app must still build and run — no long-lived broken states.
- Every task below has an **acceptance criteria** line — treat it as the definition of done for that task, not a suggestion.
- Where a task says "confirm with team," stop and ask rather than choosing silently.
- Prefer the simplest implementation that satisfies the acceptance criteria. Do not add abstraction, config options, or infrastructure not asked for below.

### Milestones (build order)

| Milestone | Goal | Epics involved |
|---|---|---|
| **M0 — Skeleton** | App shell runs, navigation between 4 tabs works, no real data yet | Epic 1 (partial), Epic 8 |
| **M1 — Core scan loop** | Camera → mock classification → confidence-gated result UI works fully | Epic 2, Epic 6 (mock only) |
| **M2 — Logging & traceability** | Every scan persists and shows in the log; manual override works | Epic 3, Epic 4 |
| **M3 — Collection & admin** | Tasks tab and dashboard are real (not static), driven by the same data | Epic 5, Epic 7 |
| **M4 — Accounts & offline** | Login/roles, offline queue and sync | Epic 1 (full), Epic 9 |
| **M5 — Real AI (stretch)** | Swap mock classifier for a trained/on-device model | Epic 6 (real model) |
| **M6 — Polish** | Alerts, empty/error states, accessibility pass | Epic 8, Epic 10 |

If time runs out, stop at the end of the last fully-completed milestone — a fully working M3 beats a half-working M5.

---

## 3. Roles & permissions

| Role | Can do | Cannot do |
|---|---|---|
| **Healthcare worker** | Use Live Scanner, view own scan history, manually override a result | View other wards' data, access admin dashboard |
| **Collection worker** | View assigned pickup tasks, mark collected, scan handover barcode/QR | Use Live Scanner classification features, access dashboard |
| **Ward/hospital admin** | View dashboard, all logs, all alerts, export reports, manage users | — (superset of others, read-only on operational data) |

Role is set at account creation and determines which tabs are visible (see Epic 1, Task 1.3).

---

## 4. System architecture

```
┌─────────────────────────────────────────────┐
│  Client — React PWA (mobile-first, installable) │
│  ┌───────────┐ ┌───────────┐ ┌─────────────┐ │
│  │  Scanner   │ │    Log     │ │  Dashboard   │ │
│  └─────┬──────┘ └─────┬──────┘ └──────┬───────┘ │
│        │  Classifier interface (Epic 6) │        │
│        │  (Mock impl  |  TFJS impl)     │        │
│        └───────────────┬────────────────┘        │
│              Local offline queue (IndexedDB)       │
└─────────────────┬───────────────────────────────┘
                   │ sync when online
┌─────────────────▼───────────────────────────────┐
│  Backend — Firebase                              │
│   Auth (roles) · Firestore (data) · Cloud        │
│   Functions (business logic) · Hosting            │
└───────────────────────────────────────────────────┘
```

**Why this stack (not open for debate unless team overrides):** the whole point of this build is finishing a working, demoable product fast. Firebase removes the need to build auth, a database, hosting, and real-time sync from scratch — all of which the feature list depends on. A React PWA (not native) means one codebase, camera access via the browser `getUserMedia` API, installable to a phone home screen, and no app-store friction before a demo.

- **Frontend:** React + Vite, plain CSS (no heavy UI framework — keep bundle small and startup fast). Router: React Router.
- **State:** React context + hooks. No Redux — the data model is small enough not to need it.
- **Backend:** Firebase Auth, Firestore (NoSQL, real-time listeners), Cloud Functions (Node.js) for server-side logic, Firebase Hosting.
- **AI inference:** TensorFlow.js running client-side (Epic 6) — keeps inference local/fast and avoids a server round-trip, matching the "near-instant feedback" requirement.
- **Offline:** Firestore's built-in offline persistence + a small custom queue for classifier events captured while fully offline (Epic 9).

---

## 5. Data model (Firestore collections)

| Collection | Fields | Notes |
|---|---|---|
| `users` | `uid`, `name`, `role` (`worker`\|`collector`\|`admin`), `wardId`, `hospitalId` | role drives UI routing |
| `wards` | `id`, `hospitalId`, `name`, `binIds[]` | |
| `bins` | `id`, `wardId`, `category` (`yellow`\|`red`\|`white`\|`blue`), `fillPercent`, `barcodeId` | `fillPercent` updated manually in MVP, sensor-driven later |
| `wasteEvents` | `id`, `itemLabel`, `category`, `confidence`, `wasEdited` (bool), `originalCategory` (nullable), `wardId`, `userId`, `createdAt` | one doc per scan; immutable once written except `wasEdited`/`originalCategory` set on override |
| `collectionTasks` | `id`, `binId`, `wardId`, `status` (`pending`\|`collected`), `assignedTo`, `requestedAt`, `completedAt` | |
| `handoverRecords` | `id`, `collectionTaskId`, `barcodeScanned`, `scannedAt`, `scannedBy` | Epic 5 |
| `alerts` | `id`, `type` (`bin_full`\|`low_confidence_spike`\|`overdue_pickup`), `refId`, `status` (`open`\|`resolved`), `createdAt` | Epic 8 |

**Firestore security rules (Task 1.4):** workers can only write `wasteEvents` for their own `wardId`; collectors can only update `collectionTasks` assigned to them; only admins can read across wards. Confirm exact rule syntax against current Firebase rules docs when implementing — do not hand-write rules from memory without checking current syntax.

---

## 6. Cloud Functions (server-side logic)

| Function | Trigger | Does |
|---|---|---|
| `onWasteEventCreated` | Firestore `onCreate` on `wasteEvents` | If `confidence < LOW_CONFIDENCE_THRESHOLD`, increments a rolling low-confidence counter; if it crosses a threshold in a short window, creates an `alerts` doc |
| `onBinFillUpdated` | Firestore `onUpdate` on `bins` | If `fillPercent >= 80`, auto-creates a `collectionTasks` doc if one isn't already pending for that bin, and an `alerts` doc |
| `onCollectionTaskCompleted` | Firestore `onUpdate` on `collectionTasks` | When status flips to `collected`, timestamps `completedAt`, resets the bin's `fillPercent` to 0 |

---

## 7. Feature epics and task backlog

Each task lists **acceptance criteria (AC)** — treat these as the test to run before marking the task done.

### Epic 1 — Auth & roles
- **1.1** Firebase Auth email/password sign-in screen. *AC: a user can sign in and land on the correct home tab for their role.*
- **1.2** Seed script or admin UI to create demo users for each role (for the hackathon demo, hardcode 3 demo accounts: worker/collector/admin). *AC: all three demo accounts work and route correctly.*
- **1.3** Role-based navigation: hide Tasks/Dashboard tabs from workers, hide Scanner from collectors, show everything to admins. *AC: each role sees only its permitted tabs.*
- **1.4** Firestore security rules matching the role table in Section 3. *AC: a worker's client cannot read another ward's `wasteEvents` (test manually via console).*

### Epic 2 — Live Scanner
- **2.1** Camera view component using `getUserMedia`, handling three states: permission granted, denied, unavailable. *AC: all three states render something usable — denied/unavailable still allow the scan button to work via the mock classifier.*
- **2.2** "Scan item" button triggers classification via the Epic 6 classifier interface, shows a brief analyzing state (~800ms), then the result. *AC: tapping scan always produces a result within ~1s, never hangs.*
- **2.3** Confidence-gated result UI: above threshold shows colored bin panel (color matched to real BMW category colors — yellow/red/white/blue) with item label, category, confidence %, and disposal route text. Below threshold shows a visually distinct neutral/amber "unable to confidently identify — manual verification required" panel. *AC: threshold constant is a single named config value (`CONFIDENCE_THRESHOLD`), not hardcoded in multiple places.*
- **2.4** No mandatory confirm-tap for high-confidence results — the result itself is the end state; a "not this? correct it" link is present but optional. *AC: user can complete a scan with a single tap (Scan) and no further required interaction.*

### Epic 3 — Manual override & fallback
- **3.1** Manual category picker (4 large buttons, color-coded) shown automatically in the low-confidence state and available on demand from any result via "correct it." *AC: picking a category writes a `wasteEvents` doc with `wasEdited: true` and the correct `originalCategory` retained.*
- **3.2** Overrides must never be silently discarded — every override is a first-class logged event, not just a UI-only correction. *AC: an overridden event is visible in the Log tab with a visible "corrected" indicator.*

### Epic 4 — Waste event logging
- **4.1** Every scan (confident or not, overridden or not) writes one `wasteEvents` doc. *AC: doc count in Firestore matches number of scans performed during manual testing.*
- **4.2** Log tab: real-time list (Firestore listener, not polling) of the current user's ward's events, newest first, with category color dot, item label, timestamp, confidence, and an "edited" badge where applicable. *AC: a new scan appears in the Log tab within ~1s without a manual refresh.*
- **4.3** Empty state for Log tab when no events exist yet, written per the "empty state is an invitation, not an apology" principle — name what will appear here, not just "no data." *AC: a fresh account with zero events sees a clear, friendly empty state, not a blank screen.*

### Epic 5 — Collection tasks & handover
- **5.1** Tasks tab (collector role) lists `collectionTasks` where `status == pending`, filtered to the collector's assigned wards. *AC: a task created by the `onBinFillUpdated` function appears here without any manual step.*
- **5.2** "Mark collected" button updates task status, which triggers `onCollectionTaskCompleted`. *AC: after marking collected, the task moves out of the pending list and the corresponding bin's fill level visibly resets on the dashboard.*
- **5.3** (Stretch) Barcode/QR scan step at handover using the device camera, writing a `handoverRecords` doc. *AC: only build this if Milestones 0–4 are fully done with time remaining.*

### Epic 6 — Classifier interface (this is the most important architectural decision in the app)
- **6.1** Define a single classifier interface: `classify(imageFrame) → { itemLabel, category, confidence }`. All UI code calls this interface, never a concrete implementation directly. *AC: swapping implementations requires changing exactly one line (a config flag or import), not touching Epic 2 UI code.*
- **6.2** **MockClassifier** — cycles through a fixed, ordered array of realistic results (glove→red, cotton swab→yellow, syringe→red, glass vial→blue, unidentified item→low confidence, needle→white), looping. This is what M1–M4 are built and demoed against. *AC: results are deterministic and repeatable across app restarts, for reliable live demos.*
- **6.3** **TFJSClassifier** (Milestone 5, stretch) — loads a TensorFlow.js model (converted from a Teachable Machine export or a custom-trained model, per the dataset strategy in the planning doc), runs inference on camera frames, maps output classes to the same `{ itemLabel, category, confidence }` shape. *AC: confirm with team which trained model file to use before wiring this up — do not train a model as part of this task; that's a separate, earlier workstream.*

### Epic 7 — Admin dashboard
- **7.1** Metric cards: scans today, override rate %, low-confidence count, bins near capacity — all computed live from Firestore data, not hardcoded. *AC: numbers change correctly when new scans are performed elsewhere in the app.*
- **7.2** Bin fill-level bars per category, color-matched to real BMW colors, pulling live `fillPercent` from `bins`. *AC: reflects the same data Epic 5's task-completion flow resets.*
- **7.3** Alerts list showing open `alerts` docs, newest first. *AC: an alert created by a Cloud Function appears here without a manual refresh.*

### Epic 8 — App shell & navigation
- **8.1** Four-tab bottom navigation (Scanner, Log, Tasks, Dashboard), tabs filtered by role per Epic 1. *AC: navigation state persists correctly when switching tabs mid-flow (e.g., mid-scan).*
- **8.2** Basic error boundary so one broken screen doesn't crash the whole app during a live demo. *AC: forcing an error in one tab still leaves other tabs usable.*

### Epic 9 — Offline support
- **9.1** Enable Firestore offline persistence. *AC: app remains usable (read + queue writes) with network disabled.*
- **9.2** Local queue for `wasteEvents` created while offline, synced on reconnect. *AC: scans performed offline appear in the Log tab and Firestore once connectivity returns, with correct original timestamps.*

### Epic 10 — Accessibility & polish
- **10.1** Touch targets ≥44px throughout (workers may be wearing gloves). *AC: verified on mobile viewport, not just desktop.*
- **10.2** Color is never the only signal — every category also has a text label, for colorblind accessibility and because color perception varies on cheap phone cameras/screens. *AC: every bin-category UI element pairs color with text.*
- **10.3** Visible focus states on all interactive elements. *AC: keyboard-only navigation reaches every control.*

---

## 8. Non-functional requirements

- **Latency:** scan-to-result under ~1.5s, always — this is a workflow tool for people mid-task, not a report they'll wait around for.
- **Reliability over completeness:** every milestone must leave the app in a fully working state; never merge/ship a half-built feature that breaks existing flows.
- **Privacy:** no raw camera frames or video are persisted to the backend — only classification metadata (Section 5). Enforce this in code, not just policy.
- **Demo resilience:** the app must be fully functional with the MockClassifier and zero network connectivity, since live demos should never depend on venue wifi or a trained model being ready.

---

## 9. Suggested repo structure

```
segreguard/
  src/
    components/
      scanner/         (CameraView, ResultPanel, ManualPicker)
      log/              (LogList, LogRow)
      tasks/             (TaskList, TaskCard)
      dashboard/          (MetricCards, BinFillBars, AlertsList)
      shared/              (TabBar, EmptyState, ErrorBoundary)
    classifiers/
      classifierInterface.ts
      mockClassifier.ts
      tfjsClassifier.ts    (Milestone 5)
    lib/
      firebase.ts
      offlineQueue.ts
    hooks/
      useAuth.ts
      useWasteEvents.ts
      useCollectionTasks.ts
  functions/            (Cloud Functions, Section 6)
  firestore.rules
  README.md
```

---

## 10. What this spec deliberately leaves out

- Real model training — that's dataset/ML work, not app-build work, and shouldn't block the agent from building the full app around the MockClassifier.
- CBWTF/barcode-system integration — explicitly future scope per the planning doc; not part of this build.
- Native mobile builds (iOS/Android app-store apps) — the PWA approach covers the demo need without that overhead. Confirm with team if a native build becomes a real requirement later.
