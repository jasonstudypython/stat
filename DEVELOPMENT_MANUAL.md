# Lecture Project Development Manual

## 1. Project Overview

- Project name: `lecture`
- Purpose: interactive lecture site for `HANYANG UNIVERSITY · 2026-1 조직연구방법론`
- Framework: `Next.js 16` + `React 19`
- Main focus:
  - `/` landing page
  - `/lab` graph lab index
  - multiple interactive statistics / regression pages under `/lab/*`

This project is a **code-first lecture tool** rather than a generic CMS. Most pages are custom interactive teaching pages built directly in React.

## 2. Runtime / Tooling

- Node package manager: `npm`
- Main dependencies:
  - `next`
  - `react`
  - `react-dom`
  - `react-plotly.js`
  - `plotly.js-dist-min`
- Main scripts:
  - `npm run dev`
  - `npm run build`
  - `npm run start`
  - `npm run check:korean`

## 3. Local Run

### Recommended

Run:

```powershell
.\run_dev.bat
```

What it does:
- moves to `D:\project\lecture`
- starts the Next.js dev server
- opens Chrome to `http://localhost:3000`

### Manual run

```powershell
cd D:\project\lecture
npm.cmd run dev
```

Production build check:

```powershell
cd D:\project\lecture
npm.cmd run check:korean
npm.cmd run build
```

## 4. Deployment

- GitHub repository: [https://github.com/schiz0513/stat](https://github.com/schiz0513/stat)
- Recommended deployment: import the GitHub repo into a separate Vercel account
- Default branch: `main`

Basic deploy flow:
1. Push local changes to `main`
2. Log in to Vercel
3. Import `schiz0513/stat`
4. Confirm `Next.js` preset
5. Deploy

## 5. Directory Structure

### Important root files

- [package.json](D:/project/lecture/package.json)
- [run_dev.bat](D:/project/lecture/run_dev.bat)
- [CODING_RULES.md](D:/project/lecture/CODING_RULES.md)
- [DEVELOPMENT_MANUAL.md](D:/project/lecture/DEVELOPMENT_MANUAL.md)
- [NEW_THREAD_PROMPT.md](D:/project/lecture/NEW_THREAD_PROMPT.md)
- [data_mdis_height.json](D:/project/lecture/data_mdis_height.json)
- [data_mdis_fat.json](D:/project/lecture/data_mdis_fat.json)

### App structure

- [app/layout.js](D:/project/lecture/app/layout.js)
  - global metadata / shell
- [app/page.js](D:/project/lecture/app/page.js)
  - root landing page
- [app/globals.css](D:/project/lecture/app/globals.css)
  - almost all shared styling
- [app/lab/page.js](D:/project/lecture/app/lab/page.js)
  - lab index

### Current `/lab` pages

- [app/lab/basic-stats-1-regressions/page.js](D:/project/lecture/app/lab/basic-stats-1-regressions/page.js)
- [app/lab/basic-stats-1-scatter-bridge/page.js](D:/project/lecture/app/lab/basic-stats-1-scatter-bridge/page.js)
- [app/lab/covariance-correlation-products/page.js](D:/project/lecture/app/lab/covariance-correlation-products/page.js)
- [app/lab/gender-moderation-effect/page.js](D:/project/lecture/app/lab/gender-moderation-effect/page.js)
- [app/lab/korean-height-distribution/page.js](D:/project/lecture/app/lab/korean-height-distribution/page.js)
- [app/lab/mediation-effect/page.js](D:/project/lecture/app/lab/mediation-effect/page.js)
- [app/lab/mean-difference-distribution/page.js](D:/project/lecture/app/lab/mean-difference-distribution/page.js)
- [app/lab/multiple-regression-collinearity/page.js](D:/project/lecture/app/lab/multiple-regression-collinearity/page.js)
- [app/lab/regression-1-ols-intro/page.js](D:/project/lecture/app/lab/regression-1-ols-intro/page.js)
- [app/lab/rotating-regression/page.js](D:/project/lecture/app/lab/rotating-regression/page.js)
- [app/lab/sample-mean-distribution/page.js](D:/project/lecture/app/lab/sample-mean-distribution/page.js)
- [app/lab/t-f-analysis/page.js](D:/project/lecture/app/lab/t-f-analysis/page.js)
- [app/lab/workbench/page.js](D:/project/lecture/app/lab/workbench/page.js)

### Supporting scripts

- [scripts/check-korean-encoding.js](D:/project/lecture/scripts/check-korean-encoding.js)
  - scans `app/**/*` and `package.json` for suspicious Korean-encoding corruption patterns

### Shared lab utilities

- [app/lab/_shared/stats.js](D:/project/lecture/app/lab/_shared/stats.js)
  - shared pure math / stats helpers used by newer lab pages
  - includes seeded random, normal sampling, matrix solving, formatting helpers
- [app/lab/_shared/csv.js](D:/project/lecture/app/lab/_shared/csv.js)
  - shared browser CSV download helper
  - current convention is to export jamovi-friendly CSV columns
- [app/lab/_shared/useMobileFitScale.js](D:/project/lecture/app/lab/_shared/useMobileFitScale.js)
  - shared mobile scaling hook for slide-like fixed-width lecture layouts
  - used when a page keeps desktop composition but must fit mobile width

## 6. Page Implementation Patterns

There are two major rendering styles in this project.

### A. Plotly-based pages

Used when:
- 3D charts are needed
- built-in legends / hover are useful
- quicker scientific plotting is preferred

Typical example:
- [app/lab/basic-stats-1-regressions/page.js](D:/project/lecture/app/lab/basic-stats-1-regressions/page.js)

Characteristics:
- imports `react-plotly.js` with `dynamic(..., { ssr: false })`
- uses one large scene builder
- stores view mode, slider state, legend visibility in React state

### B. Custom SVG pages

Used when:
- exact lecture choreography matters
- step-by-step transitions matter
- custom labels / arrows / residual visuals are important

Typical examples:
- [app/lab/regression-1-ols-intro/page.js](D:/project/lecture/app/lab/regression-1-ols-intro/page.js)
- [app/lab/sample-mean-distribution/page.js](D:/project/lecture/app/lab/sample-mean-distribution/page.js)
- [app/lab/mean-difference-distribution/page.js](D:/project/lecture/app/lab/mean-difference-distribution/page.js)

Characteristics:
- direct SVG drawing
- explicit axis scaling
- custom animation-by-state rather than true animation frameworks

## 7. Data Strategy

The project currently uses three data patterns.

### A. Hard-coded educational sample data

Used for:
- regression teaching pages
- covariance / correlation examples
- deterministic reproducibility

### B. Seeded pseudo-random generated data

Used for:
- simulations
- sample mean distribution
- illustrative teaching-only distributions

### C. Extracted dataset JSON

Used for:
- Korean adult height / body-fat pages

Files:
- [data_mdis_height.json](D:/project/lecture/data_mdis_height.json)
- [data_mdis_fat.json](D:/project/lecture/data_mdis_fat.json)

### D. Export files for external analysis

Used for:
- validating lecture examples in external tools such as jamovi
- reproducing moderation-analysis visuals outside the app

Files:
- [exports/gender-moderation-effect-jamovi.csv](D:/project/lecture/exports/gender-moderation-effect-jamovi.csv)

### E. In-app CSV download

Several `/lab` pages now expose a `CSV 다운로드` button in the header.

Current rule:
- export format should be jamovi-friendly CSV
- use the shared helper in [app/lab/_shared/csv.js](D:/project/lecture/app/lab/_shared/csv.js)
- place the button under the right-side `메인으로` button
- use normal browser download behavior rather than file-system APIs

## 8. Styling Rules

Global styling is centralized in:
- [app/globals.css](D:/project/lecture/app/globals.css)

Important note:
- `globals.css` is large and includes page-specific blocks
- when editing a page, search for its page prefix first

Common prefixes:
- `.regswitch-*`
- `.samplemean-*`
- `.corr-*`
- `.reg1intro-*`
- `.multireg2-*`
- `.mediation-*`
- `.modlab-*`
- `.home-*`
- `.site-footer*`

Shared button-related selectors now also matter:
- `.lab-header-action-stack`
- `.lab-header-actions`
- `.modlab-header-actions`

These selectors provide the common pressed / hover interaction for:
- `메인으로`
- `CSV 다운로드`
- `/lab` index `홈으로`

Recommended approach:
1. find the page-specific class prefix
2. edit only that block
3. avoid broad changes to shared generic selectors unless necessary

## 9. Maintenance Rules

This project has a strict Korean-safety workflow.

### Required rules

- Use `apply_patch` for manual file edits
- Use shell mainly for:
  - reading files
  - searching
  - build/check commands
- After text/code changes, run:

```powershell
npm.cmd run check:korean
npm.cmd run build
```

### Why

Korean text can be corrupted when edited through shell-based string replacement in Windows / PowerShell. The project already has protection for this.

Reference:
- [CODING_RULES.md](D:/project/lecture/CODING_RULES.md)

## 10. Adding a New Lab Page

Recommended steps:

1. Create route:
   - `app/lab/<new-page>/page.js`
2. Add styles in:
   - [app/globals.css](D:/project/lecture/app/globals.css)
3. Add a card in:
   - [app/lab/page.js](D:/project/lecture/app/lab/page.js)
4. Run:
   - `npm run check:korean`
   - `npm run build`

Suggested page shape:
- full-width shell
- left graph / right control panel if interactive
- footer retained
- Korean UI copy kept short

If the page has downloadable source data:
1. create jamovi-friendly row objects
2. call the shared CSV helper
3. place a `CSV 다운로드` button in the header action stack
4. keep the existing `메인으로` button style unchanged

## 11. Known Project Conventions

- Newer lab pages often treat each card / stage as an independent lecture scene.
  - avoid over-abstracting card layouts unless the abstraction is clearly stable
  - shared pure utilities are fine, but page choreography should stay local
- Minimal shared utility refactoring has already been done.
  - prefer reusing [app/lab/_shared/stats.js](D:/project/lecture/app/lab/_shared/stats.js)
  - avoid duplicating new seeded-random or matrix helpers
- Some pages intentionally use page-specific CSS overrides in `app/globals.css`.
  - examples:
    - `t-f-analysis`: compressed t-axis / distribution display tuning
    - `rotating-regression`: dense metric card row
    - `gender-moderation-effect`: staged moderation explanation cards / badges
    - `mediation-effect`, `multiple-regression-collinearity`: shared right-panel table style

## 11A. Mobile Optimization Conventions

Recent work introduced a consistent mobile strategy for core lecture pages.

### Guiding principle

- Desktop keeps the original exploratory / interactive layout
- Mobile prefers guided, lecture-style reading order
- When a page has many toggles, mobile may:
  - hide the large header card
  - hide non-essential controls
  - expand key states sequentially
  - move `메인으로` to the bottom only

### Two mobile patterns

#### A. Sequential teaching stack

Used when the page is conceptually step-based.

Examples:
- [app/lab/multiple-regression-collinearity/page.js](D:/project/lecture/app/lab/multiple-regression-collinearity/page.js)
- [app/lab/mediation-effect/page.js](D:/project/lecture/app/lab/mediation-effect/page.js)
- [app/lab/gender-moderation-effect/page.js](D:/project/lecture/app/lab/gender-moderation-effect/page.js)
- [app/lab/t-f-analysis/page.js](D:/project/lecture/app/lab/t-f-analysis/page.js)
- [app/lab/basic-stats-1-scatter-bridge/page.js](D:/project/lecture/app/lab/basic-stats-1-scatter-bridge/page.js)

Typical behavior:
- desktop `rr-header` or equivalent is hidden on mobile
- sections are rendered as a mobile-only stack
- repeated card content is reduced to only stage-specific information
- CSV download buttons are usually hidden on mobile

#### B. Fixed-width fit scaling

Used when the desktop composition itself is important and should be preserved visually.

Helper:
- [app/lab/_shared/useMobileFitScale.js](D:/project/lecture/app/lab/_shared/useMobileFitScale.js)

Typical behavior:
- content keeps a fixed internal width
- outer frame scales it down to mobile width
- avoids reflowing complex graph + card compositions

### Mobile-first page notes

- `multiple-regression-collinearity`
  - mobile uses a sequential stack of 5 states
  - header is hidden
  - `메인으로` appears only at the bottom
- `mediation-effect`
  - mobile uses 3 ordered stages
  - header is hidden
- `gender-moderation-effect`
  - mobile no longer repeats all prior formula blocks
  - each stage shows only unique explanatory content
- `t-f-analysis`
  - mobile uses ordered `t` / `F` comparison + distribution sections
  - `통계량 표시` defaults to on
- `rotating-regression`
  - mobile keeps live slider interaction
  - order is `graphs -> slider -> metric cards`
- `sample-mean-distribution`
  - top controls are compacted into a shallow 2-column control block
  - run button is integrated next to the slider on mobile
- `korean-height-distribution`
  - mobile hides the desktop header
  - transformation is kept at the top
  - group views are shown sequentially
- `mean-difference-distribution`
  - mobile uses dropdowns instead of button toggles
  - left population plot height is independently tuned from the right t-distribution plot

### Important CSS prefixes for mobile work

- `.multireg2-*`
- `.mediation-*`
- `.modlab-*`
- `.tf-*`
- `.rr-rotating-*`
- `.scatter-bridge-*`
- `.samplemean-*`
- `.heightdist-*`
- `.meandiff-*`
- `.reg1intro-*`
- `.basicreg-*`

When debugging mobile issues, prefer page-prefixed rules inside `@media (max-width: 820px)` rather than broad generic overrides.

## 12. Deploy Checklist

Before pushing to GitHub / Vercel:

1. `git status --short`
2. confirm no accidental temp files are included
3. run:

```powershell
npm.cmd run check:korean
npm.cmd run build
```

4. push to `main`
5. let Vercel Git integration deploy from GitHub

- `/lab` is the graph hub
- root `/` is a separate landing page, not the lab itself
- footer exists on both root and `/lab`
- many pages are teaching-sequence driven
- “stepper” UI is preferred over opaque toggles when the interaction is sequential
- if a graph is meant for teaching, visual clarity is preferred over mathematical maximal precision unless the page explicitly teaches inference formulas

### New lecture-page conventions

- `multiple-regression-collinearity` and `mediation-effect` share the `multireg2-*` two-column shell
- `gender-moderation-effect` extends the same shell but uses `modlab-*` cards and stage-specific formula blocks
- moderation pages may have stage-specific graph titles, formula cards, and plot mode toggles, so text should be checked per stage rather than per page only
- if jamovi comparison is needed, use the CSV export file in `exports/` instead of regenerating ad hoc data
- duplicated seeded-random / matrix helper functions currently exist across several new pages; if future maintenance touches them together, consider extracting a shared utility module after verifying all lecture numbers still match
- `regression-3d` route has been removed and should not be reintroduced unless it is added back to the `/lab` index intentionally

## 12. Practical Maintenance Checklist

Before changing anything:
- confirm the target page file
- confirm whether it is Plotly-based or SVG-based
- identify page-specific CSS prefix

After changing anything:
- run `npm run check:korean`
- run `npm run build`
- test the exact route in the browser

Before deployment:
- check Git status
- commit only intended files
- push to `main`
- deploy from Vercel
- if using the Vercel CLI, verify the CLI and login state first
- re-run `npm run check:korean` and `npm run build` immediately before the deploy command

## 13. Recreate From Scratch Checklist

If a maintainer had to rebuild this app from the repo only:

1. Clone repo
2. Install Node / npm
3. Run:

```powershell
cd D:\project\lecture
npm.cmd install
```

4. Start local dev:

```powershell
npm.cmd run dev
```

5. Verify:

```powershell
npm.cmd run check:korean
npm.cmd run build
```

6. Open:
- `/`
- `/lab`
- each `/lab/*` page

## 14. Current Priority Routes

If only core teaching pages must be preserved first:

- [D:/project/lecture/app/page.js](D:/project/lecture/app/page.js)
- [D:/project/lecture/app/lab/page.js](D:/project/lecture/app/lab/page.js)
- [D:/project/lecture/app/lab/basic-stats-1-regressions/page.js](D:/project/lecture/app/lab/basic-stats-1-regressions/page.js)
- [D:/project/lecture/app/lab/multiple-regression-collinearity/page.js](D:/project/lecture/app/lab/multiple-regression-collinearity/page.js)
- [D:/project/lecture/app/lab/mediation-effect/page.js](D:/project/lecture/app/lab/mediation-effect/page.js)
- [D:/project/lecture/app/lab/gender-moderation-effect/page.js](D:/project/lecture/app/lab/gender-moderation-effect/page.js)
- [D:/project/lecture/app/lab/korean-height-distribution/page.js](D:/project/lecture/app/lab/korean-height-distribution/page.js)
- [D:/project/lecture/app/lab/sample-mean-distribution/page.js](D:/project/lecture/app/lab/sample-mean-distribution/page.js)
- [D:/project/lecture/app/lab/regression-1-ols-intro/page.js](D:/project/lecture/app/lab/regression-1-ols-intro/page.js)

These give the maintainer the main landing flow, core lab index, and representative chart implementation styles.
