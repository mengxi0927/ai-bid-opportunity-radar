# UI Redesign Direction

## Product Positioning

This product should look and behave like a B2B sales intelligence dashboard, not a generic admin panel and not a marketing site.

The UI should optimize for:
- fast scanning
- confident triage
- trust in recommendations
- clear action-taking

The design tone should be:
- modern
- professional
- calm
- data-forward
- enterprise-grade


## Overall Design Direction

Use `shadcn/ui` as the component foundation, but not as the final visual identity by itself.

The final UI should have:
- a restrained neutral base
- one strong primary accent color
- consistent semantic status colors
- clearer typography hierarchy
- compact but readable density
- fewer decorative cards and more operational structure

Avoid:
- consumer-style playful UI
- excessive gradients or glassmorphism
- oversized spacing that reduces information density
- using charts only for decoration


## Core Product Mental Model

The main workflow of this project is:

1. ingest tender data
2. enrich the tender with customer, capability, and risk context
3. rank and recommend
4. let sales review and decide
5. generate follow-up drafts

The UI should reflect this workflow directly.

The product should be organized into four user-facing zones:
- overview
- tender triage workspace
- tender intelligence detail
- action / draft generation


## Design System Recommendations

### Colors

Use a professional dashboard palette:
- neutral background with subtle contrast between app background and panel surfaces
- one primary accent for key actions and selected states
- semantic colors for recommendation, risk, and match states

Suggested status mapping:
- high priority: strong accent / solid treatment
- medium priority: softer accent
- watchlist: muted neutral
- low risk: green
- medium risk: amber
- high risk: red
- existing customer: blue or teal
- potential customer: indigo or subdued accent
- unmatched: gray
- high capability match: green
- partial capability match: amber
- low capability match: red

Status colors must be explicitly mapped, not inferred from string matching.

### Typography

Typography should communicate hierarchy clearly:
- strong page titles
- compact metadata styling
- consistent section headings
- tabular numeric styling for KPIs, scores, and dates where useful

Avoid overly large hero typography. This is an operating dashboard.

### Spacing and Density

Use a consistent spacing scale, preferably `8px`.

The interface should feel:
- compact
- readable
- structured

Tables, filters, and dashboards should have enough density to support real work.


## Recommended shadcn/ui Usage

Use `shadcn/ui` for:
- app shell and sidebar patterns
- cards
- tabs
- badges
- inputs and selects
- popovers
- command/search
- dialogs
- sheets / slide-over panels
- toasts
- alerts
- skeleton loading states
- accordion sections
- table primitives

Use `shadcn/ui` as a base layer, then refine spacing, borders, density, and visual language for this product.


## Layout Recommendations

### App Shell

The app shell should be more structured than the current minimal sidebar.

Recommended shell:
- left sidebar for primary navigation
- top bar for page context and actions
- content area with consistent page width and spacing

Sidebar navigation should include:
- Overview
- Tender Radar
- Market Insights
- Drafts / Actions
- optional future Settings / Data Sources

The shell should also support:
- active state highlighting
- environment / AI status visibility
- room for future expansion

### Page Headers

Each page should have a consistent header with:
- title
- short purpose statement
- page-level actions
- optional filter or range context


## Page-Specific UI Direction

## 1. Overview Page

The overview should be a decision dashboard, not only a card grid.

Recommended structure:

### Top section
- title
- date range or freshness indicator
- sync status
- primary action: sync latest tenders
- secondary action: view high-priority items

### KPI strip
Primary KPIs:
- scanned
- AI relevant
- high priority
- existing customer opportunities
- draftable opportunities

Each KPI should include:
- value
- short explanation
- contextual note or delta
- click-through to filtered data

### Operational panels
Below KPIs, show targeted sections such as:
- priority queue
- risk alerts
- customer opportunities
- top recommendations

Avoid overusing modal popups for metric drill-down. Prefer inline breakdowns, links, or side panels.


## 2. Tender List / Triage Workspace

This should become the operational heart of the product.

Recommended structure:

### Header actions
- sync latest tenders
- import tender URL
- save filter view

### Filter bar
- search
- recommendation level
- risk level
- customer status
- capability status
- source
- date range
- sort options

### Results layer
- total result count
- active filter chips
- clear filters action

### Table
Core columns:
- tender title
- buyer
- recommendation level
- score
- customer match
- capability match
- risk
- deadline
- actions

### Interaction improvement
Use a right-side `Sheet` for quick preview when a row is opened.

The quick preview should show:
- summary
- score
- recommendation reasons
- risks
- next steps
- quick actions

This reduces context switching and improves triage speed.


## 3. Tender Detail Page

The detail page should feel like an intelligence dossier.

Recommended layout:
- strong summary header
- two-column layout

### Header
- tender title
- buyer
- source
- published date
- deadline
- score
- recommendation badge
- primary actions

### Left column
- project summary
- structured key facts
- AI summary
- customer match details
- capability evidence
- recommendation logic

### Right column
- score summary
- risk snapshot
- next actions
- AI analysis action
- feedback form
- draft generation actions

### Content treatment
Present the reasoning in structured blocks:
- why recommend
- why risky
- what matched
- what to do next

This makes the system more trustworthy than plain paragraphs and unordered lists.


## 4. Draft / Action Flow

The draft page should feel like a guided action workflow, not only a plain form.

Recommended structure:
- left side editable draft fields
- right side recommendation rationale, risk notes, and provenance
- sticky action bar or clear footer actions

Use this page to reinforce:
- why this opportunity is worth action
- what context generated the draft
- what should be reviewed before submission


## Market Insights Direction

If market insights remain part of the product, they should be credible and decision-oriented.

Only use charts when they support decisions such as:
- trend over time
- source quality comparison
- industry concentration
- region activity
- capability gap patterns

Preferred chart types:
- line / area charts for trends
- bar charts for ranking
- stacked bars for distribution
- simple comparison visuals over decorative ones

Every insight module should answer:
- what happened
- why it matters
- what action to take


## Empty States and First-Run Experience

This app depends heavily on imported tender data, so empty-state design matters.

The first-run experience should clearly explain:
- what the system does
- how to import a first tender
- how to run weekly crawl
- whether AI analysis is configured
- what users will see after data is loaded

A good first-run state will prevent the product from feeling broken.


## Interaction and UX Improvements

The redesign should add:
- skeleton loading states
- toast feedback for sync, import, AI analysis, and draft actions
- explicit success/error alerts
- filter chips with fast removal
- sticky filters for long list views
- keyboard-friendly navigation
- shareable filter state in URL
- better empty states
- more visible primary actions


## Component Behavior Recommendations

### Badges
- use consistent variants
- keep compact sizing
- ensure contrast is strong enough for dashboards

### Tables
- keep dense row height
- make important columns sticky if helpful
- support row-level quick actions
- avoid visually noisy borders

### Cards
- use cards selectively
- do not turn every section into identical boxes
- use visual hierarchy through spacing and typography, not only borders

### Dialogs and Sheets
- use dialogs for confirmation
- use sheets for preview and secondary workflows
- avoid interruptive modal patterns for basic information inspection


## Prioritized Implementation Strategy

Recommended order of UI implementation:

1. establish design tokens and visual system
2. rebuild app shell and navigation
3. normalize badge/status system
4. redesign tender list as the primary workspace
5. redesign tender detail page
6. redesign overview page
7. redesign draft/action page
8. refine market insights page

This order improves the highest-value user workflow first.


## Non-Goals

Do not optimize for:
- flashy startup landing-page aesthetics
- too many visual effects
- overly playful interactions
- default unmodified component-library styling

This product should feel like a modern internal intelligence tool used daily by sales and pre-sales teams.


## Success Criteria

The UI redesign is successful if:
- users can understand the product within minutes
- the tender list becomes the natural daily triage workspace
- recommendation confidence improves because reasoning is clearer
- actions like draft generation and follow-up feel direct and intentional
- the app looks modern and professional without becoming visually noisy
