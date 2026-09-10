# Graph Report - segreguard  (2026-09-10)

## Corpus Check
- 29 files · ~29,343 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 227 nodes · 421 edges · 12 communities (11 shown, 1 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 3 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `38cf40ec`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- firestoreOps.js
- Scanner.jsx
- SIH 2026 — PS 26115 — Internal Project Documentation
- SegreGuard — Engineering Specification & Build Backlog
- App.jsx
- package.json
- dependencies
- .oxlintrc.json
- React + Vite
- firebase.js
- vercel.json

## God Nodes (most connected - your core abstractions)
1. `SIH 2026 — PS 26115 — Internal Project Documentation` - 27 edges
2. `react` - 14 edges
3. `SegreGuard — Engineering Specification & Build Backlog` - 13 edges
4. `evaluateLegalCategory()` - 12 edges
5. `getLocalBins()` - 12 edges
6. `Scanner()` - 11 edges
7. `useRole()` - 11 edges
8. `getLocalRequests()` - 11 edges
9. `7. Feature epics and task backlog` - 11 edges
10. `Dashboard()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `AppContent()` --calls--> `seedData()`  [EXTRACTED]
  src/App.jsx → src/lib/firestoreOps.js
- `LogList()` --calls--> `subscribeToWasteEvents()`  [EXTRACTED]
  src/components/log/LogList.jsx → src/lib/firestoreOps.js
- `Scanner()` --calls--> `useRole()`  [EXTRACTED]
  src/components/scanner/Scanner.jsx → src/context/RoleContext.jsx
- `Scanner()` --calls--> `addWasteEvent()`  [EXTRACTED]
  src/components/scanner/Scanner.jsx → src/lib/firestoreOps.js
- `Scanner()` --calls--> `requestPickupFromNurse()`  [EXTRACTED]
  src/components/scanner/Scanner.jsx → src/lib/firestoreOps.js

## Import Cycles
- None detected.

## Communities (12 total, 1 thin omitted)

### Community 0 - "firestoreOps.js"
Cohesion: 0.14
Nodes (42): Dashboard(), acceptLogisticsRequest(), addWasteEvent(), adminDirectRequest(), approveAndDispatchToLogistics(), attachLocalBinsListener(), attachLocalEventsListener(), attachLocalTasksListener() (+34 more)

### Community 1 - "Scanner.jsx"
Cohesion: 0.10
Nodes (30): CATEGORY_INFO, CONFIDENCE_THRESHOLD, captureOptimizedFrameBase64(), classifyWithGemini(), DEFAULT_GEMINI_API_KEY, GEMINI_MODELS, capitalize(), CLINICAL_VOCABULARY (+22 more)

### Community 2 - "SIH 2026 — PS 26115 — Internal Project Documentation"
Cohesion: 0.06
Nodes (33): 10. Dataset Strategy — Be Honest About the Hardest Part, 11. Technology Stack (Reasonable, Not Over-Engineered for a Hackathon), 12. Backend Architecture & Database Design (Core Entities), 13. UI/UX Structure, 14. Safety Mechanisms & Confidence Handling (Consolidated), 15. Innovation Points Worth Leading With, 16. Critical Weaknesses in the Original Idea — Named Directly, With Fixes, 17. Feasibility: What Software Can Realistically Do vs. What Needs More (+25 more)

### Community 3 - "SegreGuard — Engineering Specification & Build Backlog"
Cohesion: 0.08
Nodes (24): 0. Kickoff prompt (paste this first, then paste the rest of the doc as reference), 10. What this spec deliberately leaves out, 1. Product summary (context for the agent), 2. Software process model, 3. Roles & permissions, 4. System architecture, 5. Data model (Firestore collections), 6. Cloud Functions (server-side logic) (+16 more)

### Community 4 - "App.jsx"
Cohesion: 0.17
Nodes (13): react, App(), AppContent(), LogList(), ErrorBoundary, RolePicker(), TAB_CONFIG, TabBar() (+5 more)

### Community 5 - "package.json"
Cohesion: 0.10
Nodes (20): oxlint, devDependencies, oxlint, @types/react, @types/react-dom, vite, @vitejs/plugin-react, name (+12 more)

### Community 6 - "dependencies"
Cohesion: 0.12
Nodes (17): firebase, lucide-react, dependencies, firebase, lucide-react, react, react-dom, react-router-dom (+9 more)

### Community 7 - ".oxlintrc.json"
Cohesion: 0.25
Nodes (7): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema, oxc, warn

### Community 8 - "React + Vite"
Cohesion: 0.50
Nodes (3): Expanding the Oxlint configuration, React Compiler, React + Vite

### Community 9 - "firebase.js"
Cohesion: 0.50
Nodes (3): app, db, firebaseConfig

## Knowledge Gaps
- **95 isolated node(s):** `$schema`, `oxc`, `react/rules-of-hooks`, `warn`, `name` (+90 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `App.jsx` to `firestoreOps.js`, `Scanner.jsx`, `.oxlintrc.json`?**
  _High betweenness centrality (0.043) - this node is a cross-community bridge._
- **Why does `plugins` connect `.oxlintrc.json` to `App.jsx`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **What connects `$schema`, `oxc`, `react/rules-of-hooks` to the rest of the system?**
  _95 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `firestoreOps.js` be split into smaller, more focused modules?**
  _Cohesion score 0.1404040404040404 - nodes in this community are weakly interconnected._
- **Should `Scanner.jsx` be split into smaller, more focused modules?**
  _Cohesion score 0.10336817653890824 - nodes in this community are weakly interconnected._
- **Should `SIH 2026 — PS 26115 — Internal Project Documentation` be split into smaller, more focused modules?**
  _Cohesion score 0.058823529411764705 - nodes in this community are weakly interconnected._
- **Should `SegreGuard — Engineering Specification & Build Backlog` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._