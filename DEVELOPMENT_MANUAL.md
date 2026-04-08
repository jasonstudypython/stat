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
- [app/lab/regression-3d/page.js](D:/project/lecture/app/lab/regression-3d/page.js)
- [app/lab/rotating-regression/page.js](D:/project/lecture/app/lab/rotating-regression/page.js)
- [app/lab/sample-mean-distribution/page.js](D:/project/lecture/app/lab/sample-mean-distribution/page.js)
- [app/lab/t-f-analysis/page.js](D:/project/lecture/app/lab/t-f-analysis/page.js)
- [app/lab/workbench/page.js](D:/project/lecture/app/lab/workbench/page.js)

### Supporting scripts

- [scripts/check-korean-encoding.js](D:/project/lecture/scripts/check-korean-encoding.js)
  - scans `app/**/*` and `package.json` for suspicious Korean-encoding corruption patterns

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

## 11. Known Project Conventions

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
