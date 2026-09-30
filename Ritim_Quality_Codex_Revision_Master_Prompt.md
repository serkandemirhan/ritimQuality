# Ritim Quality — Desktop-First UI/UX Revision Master Prompt for Codex

> Kullanıcı kararı: **Phase 31 — Language System bu aşamada kapsam dışıdır. Uygulama Türkçe ile devam eder.**
> Devam kaydı: 0–30 ve 32–44 uygulandı. 45. fazın yerel doğrulama sonuçları ve cihaz/canlı servis sınırları aşağıdaki belgede tutulur.
> Ayrıntılar ve test sınırları: [0–10](docs/desktop-revision-phases-0-10.md), [11–20](docs/desktop-revision-phases-11-20.md), [21–30](docs/desktop-revision-phases-21-30.md).
> 31 ertelendi; kalan fazların doğrulama durumu ilerleme belgelerinde tutulur.
> Son devam kaydı: [32–45 uygulama ve doğrulama](docs/desktop-revision-phases-32-45.md).

## ROLE

You are revising the existing **Ritim Quality** application.

Your job is **not** to redesign the product from scratch and not to invent new business functionality.

Your job is to:

- preserve the existing application logic,
- preserve existing workflows and data behavior,
- preserve existing routes unless a route change is technically necessary,
- modernize and unify the visual system,
- make the application feel like the same product family as the Ritim Quality marketing website,
- create a premium industrial application experience,
- complete the work in the exact order defined below.

The target design language is:

**Precise. Industrial. Alive.**

The marketing website is cinematic.

The application must be:
- operational,
- readable,
- efficient,
- professional,
- premium,
- industrial,
- data-focused.

Do not turn the application into a marketing website.

---

# CRITICAL RULES

1. **Desktop first.**
   Do not start the mobile redesign until the desktop phases below are complete.

2. **Do not break existing functionality.**
   Existing forms, workflows, API calls, validation, permissions, data retrieval, tables, filters, and actions must continue to work.

3. **Do not remove features.**
   If an existing page contains functionality that is not explicitly mentioned below, preserve it and visually adapt it.

4. **Do not invent new business features unless clearly marked as optional.**

5. **Use shared components.**
   Do not create page-specific CSS or page-specific versions of the same button/table/form pattern unless absolutely required.

6. **Create a reusable design system first.**

7. **Do not refactor backend/domain logic just to achieve visual changes.**

8. **Do not introduce unnecessary animation.**
   Motion must explain state, hierarchy, data flow, selection, validation, progress, or transitions.

9. **Red must be used carefully.**
   Ritim brand red is also close to a quality NOK/error color. Do not make every primary button red.

10. **Maintain accessibility.**
    Keyboard focus, semantic labels, contrast, status icons, keyboard navigation, reduced motion, and touch targets must remain usable.

11. **Do not proceed randomly through pages.**
    Follow the ordered phases below.

12. After each phase:
    - run the app,
    - verify affected routes,
    - check console errors,
    - check responsive behavior,
    - check dark shell/light workspace consistency,
    - confirm no business logic regression,
    - then continue.

---

# DESIGN FOUNDATION

## Brand / Color System

Use the following direction:

- Main dark navy / application shell: `#010616`
- Main workspace: very light gray / off-white, not pure white everywhere
- Cards: white or very light slate
- Borders: subtle cool gray / blue-gray
- Text: dark navy/charcoal in light workspace
- Secondary text: muted blue-gray
- Brand accent: Ritim red
- Success / OK: controlled green
- Warning: amber
- NOK / error: semantic red distinct enough from decorative brand usage
- Info: controlled blue

### Important
Do not make all primary buttons red.

Prefer:
- dark navy primary action,
- neutral secondary,
- red only for selected signal/accent/brand and semantic alert situations.

---

# TYPOGRAPHY

Create a consistent type system.

Use:

- modern sans-serif for interface text,
- monospace for machine/data values.

Use monospace for values such as:

- `25.14`
- `WO-20261`
- `L260916`
- `CNC-04`
- Cp / Cpk values
- timestamps
- serial numbers
- measurement values
- machine IDs
- batch IDs
- technical codes

Define shared styles for:

- page title
- page subtitle
- section title
- card title
- body
- helper text
- field label
- table text
- technical value
- KPI value

---

# SPACING / LAYOUT SYSTEM

Use a consistent 4px / 8px based spacing scale.

Standardize:

- page padding,
- section spacing,
- card padding,
- field spacing,
- table density,
- header alignment,
- action alignment.

Avoid random paddings and inconsistent margins.

Desktop layouts must work at:

- 1920px
- 1440px
- 1366px
- 1280px

---

# PHASE 0 — DESIGN SYSTEM

Do this first.

Create or standardize the following shared primitives/components:

- AppShell
- Sidebar
- Topbar
- PageContainer
- PageHeader
- PageActions
- Breadcrumb
- Button
- IconButton
- Badge / StatusBadge
- Card
- MetricCard
- Input
- NumberInput
- MeasurementInput
- Select
- MultiSelect
- DatePicker
- DateRangePicker
- Switch
- Checkbox
- Radio
- Textarea
- SearchInput
- FilterBar
- DataTable
- TableToolbar
- Pagination
- EmptyState
- Skeleton
- Toast
- Modal
- ConfirmDialog
- Drawer
- DetailDrawer
- Tabs
- FormSection
- ChartCard
- KpiMetric
- TraceTimeline
- SampleProgress
- ToleranceBand

## Acceptance criteria

- No page should invent its own button style.
- No page should invent its own input style.
- No page should invent its own badge colors.
- Tables must share the same structure.
- Form fields must share the same sizing and states.
- Focus-visible states must be present.
- Loading / disabled / error / success states must be consistent.

---

# PHASE 1 — APPLICATION SHELL

Redesign the global application shell.

## Sidebar

Use a dark Ritim shell based on `#010616`.

Target sizes:

- expanded: approximately 230–250px
- collapsed: approximately 68–76px

Sidebar must support collapse.

Preserve existing navigation behavior.

Organize navigation visually into logical groups where possible without breaking routes:

### Operate
- Overview
- Tasks
- Nonconformities
- Approvals

### Quality
- Products
- Control Plans
- Measurement Station
- Measurement Records

### Analytics
- SPC
- Reports

### Administration
- Organization
- Users
- Settings
- Business Rules
- Audit
- Data Management
- Subscription

If current navigation contains additional entries:
- keep them,
- place them in the closest logical group.

## Active state

Do not use a generic bright blue selected rectangle.

Use:
- dark selected surface,
- subtle Ritim signal/accent,
- clear icon/text contrast.

## Topbar

Include existing functionality and visually support:

- current site / plant if available,
- notifications,
- language,
- user/account menu,
- environment indicator if one already exists.

Do not add fake data if this information does not exist.

## Acceptance criteria

- All routes remain reachable.
- Sidebar collapse works.
- Active navigation is clear.
- Layout works at 1280px and above.
- Main workspace has consistent page padding.
- No content is hidden behind shell elements.

---

# PHASE 2 — GLOBAL PAGE HEADER PATTERN

Create one standard PageHeader pattern.

Each page may contain:

- title
- short description
- optional breadcrumb
- optional KPI summary strip
- primary action
- secondary actions

Example:

Products  
Manage product specifications and quality plans

Summary:
- 143 Products
- 126 Active
- 17 Draft

Actions:
- Import
- Export
- New Product

Do not fabricate KPI values.
Use existing data only.

---

# PHASE 3 — OVERVIEW / DASHBOARD

Redesign the existing Overview page.

Goal:
Create a true **quality operations dashboard**, not a generic SaaS dashboard.

## Main structure

### Header

Example style:
`Quality status across your production`

### KPI cards

Use available existing data for:

- inspections today
- first pass quality
- open nonconformities
- process alerts

If one of these is not supported by the current backend:
- do not fake it,
- keep the closest existing KPI,
- visually fit it into the new system.

Each KPI card may contain:
- main value,
- trend,
- micro sparkline,
- comparison period.

### Quality Pulse

Create a main visual area that can represent:
- recent quality trend,
- inspection result trend,
- process health,
- or the most relevant current dashboard data.

Use a restrained Ritim pulse visual language.

Do not create meaningless decorative animation.

### Requires Attention

Surface existing actionable items such as:
- SPC alerts,
- NOK inspections,
- overdue tasks,
- waiting approvals,
- open nonconformities.

### Recent Inspections

Create a compact table/list using the shared table system.

## Acceptance criteria

- Dashboard is understandable in under 5 seconds.
- Critical quality conditions visually stand out.
- It feels operational, not decorative.
- No invented metrics.

---

# PHASE 4 — PRODUCTS LIST

Redesign the Products page as a professional Product Library.

## Header actions

Use existing functions:
- Search
- Import
- Export
- New Product

## Filters

Where supported:
- status
- product family/category
- control plan
- last updated

## Table

Prefer table as the primary view.

Possible columns where current data exists:

- thumbnail / drawing preview
- product code
- product name
- revision
- active control plan
- number of characteristics
- last inspection
- quality status

Do not invent missing fields.

## Technical values

Use monospace for:
- product code
- revision
- technical identifiers.

## Acceptance criteria

- Dense but readable.
- Easy to search.
- Easy to compare products.
- Row action behavior remains unchanged.

---

# PHASE 5 — PRODUCT DETAIL

Redesign Product Detail.

## Header

Clearly show:
- product name
- product code
- revision
- material if available
- status

## Main content

Support the existing data and organize it into tabs where appropriate:

- Overview
- Control Plans
- Drawings
- Inspections
- Quality History

Do not create empty tabs if the current application does not support the underlying data.

## Overview can contain

- product metadata
- technical drawing
- active plan
- latest inspections
- current quality status
- open nonconformities if available

## Acceptance criteria

- Important identity information is visible immediately.
- Technical drawing has enough space.
- Existing actions remain available.

---

# PHASE 6 — PRODUCT CREATE / EDIT

Replace long undifferentiated forms with clear sections.

Suggested grouping where existing fields support it:

- Basic Information
- Classification
- Manufacturing Information
- Drawings / Documents
- Quality Defaults

Actions:

- Save Draft if current logic supports it
- Save
- Activate if current logic supports it
- Cancel

Do not add workflow states that do not exist.

Validation must remain functional.

---

# PHASE 7 — CONTROL PLAN LIST

Redesign the Control Plans list.

Where data exists, display:

- plan code
- product
- revision
- status
- characteristic count
- effective date
- last updated
- author

Actions may include only currently supported functions:

- open
- edit
- create revision
- duplicate
- archive

Do not invent unavailable functions.

---

# PHASE 8 — CONTROL PLAN EDITOR

This is one of the three signature screens.

Give this screen the highest visual and UX quality.

Target layout:

## Left panel — Plan Structure

Display the actual hierarchy available in the app.

Example:

Revision 07  
Operation 10  
- Outer Diameter
- Surface
- Thread Depth

Support current selection/edit behavior.

Use drag/drop only if drag/drop already exists or can be added without changing domain behavior.

## Center — Drawing / Inspection Canvas

Provide the largest workspace.

Support existing:
- drawing/image display
- inspection point markers
- characteristic selection
- zoom/pan if already present

If zoom/pan is already simple to add without changing the data model, it may be improved.

## Right — Characteristic Properties

For the selected characteristic, show available properties.

For numeric characteristics, if supported:

- Target
- LSL
- USL
- Unit
- Sampling
- Instrument
- Frequency

For other existing types:
- OK/NOK
- visual
- text
- media

Preserve the actual field schema.

## Header actions

Use current workflow actions.

Examples if currently supported:
- Preview
- Save Draft
- Publish Revision

Show:
- revision
- status
- unsaved changes

## Acceptance criteria

- User can understand plan hierarchy immediately.
- Drawing is central, not squeezed.
- Characteristic editing is clear.
- Revision state is always visible.
- No existing editing capability is lost.
- Screen is presentation/demo quality.

---

# PHASE 9 — MEASUREMENT PREPARATION

Redesign the measurement setup/start page.

Prioritize:

- product
- work order
- machine
- lot/serial
- operator
- control plan
- QR/manual selection if already supported.

Primary action:
`Start Inspection`

The user must clearly understand what they are about to inspect.

---

# PHASE 10 — QR / BARCODE FLOW

Preserve current scan logic.

Improve:

- scan layout
- camera frame
- manual entry fallback
- successful scan state
- invalid scan state
- product/work order confirmation.

Do not change QR payload/business logic.

---

# PHASE 11 — LABEL / PRINT PAGE

Improve:

- print preview
- QR/barcode presentation
- product
- lot/serial
- work order
- quantity
- printer
- copy count
- existing print actions.

Do not alter printing logic unless needed for presentation.

---

# PHASE 12 — MEASUREMENT TERMINAL

This is the second signature screen.

Do NOT make this look like an admin page.

It should look like a dedicated shop-floor operator workspace.

## Main priority

The operator must instantly understand:

1. what am I measuring?
2. what is the target?
3. what value did I enter?
4. is it OK or NOK?
5. what do I do next?

## Suggested layout using existing data

Header:
- Product
- Work Order
- Machine
- Operator

Progress:
- Sample 4 / 5
- characteristic progress

Main area:
- characteristic name
- target
- tolerance
- unit
- large measurement input
- current result

Example visual hierarchy:

Outer Diameter  
Target 25.00 ± 0.10

25.14  
mm

NOK

## Actions

Use only supported actions:
- Save Measurement
- Retake
- Skip + reason if currently supported
- Next Characteristic
- Add Comment
- Add Photo / Evidence if currently supported

## NOK behavior

When a value is NOK:
- highlight clearly,
- show spec,
- do not rely on red color alone,
- provide an icon / label,
- expose any existing nonconformity action.

Do not create an automatic NC workflow if one does not already exist.

## Acceptance criteria

- Large readable measurements.
- Suitable for factory use.
- Fast entry.
- Keyboard friendly.
- No unnecessary visual clutter.
- The `25.14` quality story from the marketing site is reflected here as real product UI.

---

# PHASE 13 — TASKS

Redesign tasks using existing data.

Display where available:

- task
- priority
- due date
- status
- owner
- product
- inspection
- NC relation

Keep current assignment and completion actions.

Use DetailDrawer where appropriate.

---

# PHASE 14 — NONCONFORMITIES

Redesign the Nonconformities area.

Display existing fields such as:

- status
- severity
- product
- lot
- machine
- source measurement
- owner
- root cause
- action
- due date

Use a timeline/detail view for existing NC lifecycle data.

Support existing:
- comments
- evidence
- inspection link
- action history.

Do not invent a CAPA module unless it already exists.

---

# PHASE 15 — APPROVALS

Create a clear approval queue.

Display existing data:

- approval type
- product
- revision
- requested by
- request date
- current status

Preserve:
- approve
- reject
- comment.

If revision diff data exists, show it visually.
Do not fake revision diffs.

---

# PHASE 16 — MEASUREMENT RECORDS

This is a high-density operational table.

## Summary

Where backend data exists, show:

- total measurements
- OK
- NOK
- waiting approval

## Filters

Use available filters:
- date
- product
- characteristic
- machine
- operator
- result
- plan

## Table

Where fields exist:

- time
- product
- characteristic
- value
- specification
- result
- machine
- operator

Use monospace for measurement values.

For NOK:
- subtle background accent
- NOK label/icon
- clear specification.

Clicking a row should preserve current navigation behavior or use the shared DetailDrawer if safe.

---

# PHASE 17 — MEASUREMENT / INSPECTION DETAIL

Avoid a tiny modal for complex information.

If feasible without breaking routing:
- use a wide right-side DetailDrawer,
- or existing full detail page.

Organize available data into:

- inspection identity
- product
- work order
- lot/serial
- machine
- operator
- timestamp
- plan revision
- measurements
- spec
- result
- instrument
- comment
- evidence
- approval
- traceability
- audit information.

Do not display data the API does not provide.

---

# PHASE 18 — QUALITY REPORT

Create a clean printable/report-style design.

Use existing report data:

- product
- lot
- inspection
- result
- measurements
- approvals
- company/plant information
- signatures if already supported.

Keep it more formal and calm than the marketing site.

Preserve PDF / print behavior.

---

# PHASE 19 — EXPORT

Improve current export experience.

Use currently supported export formats such as:
- CSV
- Excel
- PDF

Where functionality exists:
- scope
- filters
- column selection
- progress
- history

Do not implement async export infrastructure unless the backend already supports it or it is separately requested.

---

# PHASE 20 — SPC

This is the third signature screen.

Make this a premium quality analytics workspace.

## Header filters

Use existing:
- Product
- Characteristic
- Machine
- Date Range
- Shift

## KPIs

If the current backend provides them:
- Cp
- Cpk
- Mean
- Sigma
- Sample Count

Use large monospace numeric values.

## Main Chart

Prioritize:
- control chart
- target
- LSL
- USL
- sample points
- NOK points
- outliers
- tooltip.

Use the same restrained signal language as Ritim marketing.

## Secondary analytics

Only if currently supported:
- histogram
- distribution
- trend
- raw measurement table
- capability chart

## Acceptance criteria

- Chart is the visual focus.
- Technical values are easy to read.
- NOK/outlier states are obvious.
- Screenshot quality should be suitable for sales demos and presentations.
- No unnecessary chart decoration.

---

# PHASE 21 — CHART SYSTEM

Standardize chart styling across the app:

- control chart
- trend
- histogram
- sparkline
- capability
- Pareto if it already exists.

Standardize:

- tooltip
- legend
- axes
- date formatting
- target line
- LSL
- USL
- NOK point
- empty state
- loading state.

---

# PHASE 22 — TRACEABILITY

Use a consistent visual TraceTimeline or relation view.

Where current data supports it, connect:

- Product
- Work Order
- Machine
- Lot
- Serial
- Operator
- Inspection
- Measurement
- Nonconformity
- Approval

Do not create false relationships.

The visual concept should feel related to the marketing site's traceability story, but remain practical.

---

# PHASE 23 — USERS

Redesign user management.

Use existing fields such as:

- user
- email
- role
- plant access
- status
- last login

Preserve existing actions:
- invite
- deactivate
- role assignment
- access management.

---

# PHASE 24 — ROLES / PERMISSIONS

If this area exists:

Improve visual readability of:
- roles
- permission groups
- plant access
- action permissions.

Prefer a readable permission matrix.

Do not change authorization logic.

---

# PHASE 25 — SETTINGS

Group settings into clear sections.

Examples where existing fields support them:

- General
- Quality Defaults
- Units
- Language
- Date / Time
- Plant Defaults
- Notifications
- Integrations

Avoid one huge undifferentiated form.

---

# PHASE 26 — BUSINESS RULES

Preserve current rule engine behavior.

Improve:

- list readability
- active/inactive states
- trigger
- condition
- action
- priority
- edit/duplicate/disable.

Do not turn it into an artificial no-code builder unless the application already works that way.

---

# PHASE 27 — AUDIT LOG

Design a dense but readable audit log.

Use existing fields:

- timestamp
- user
- action
- entity
- before/after
- source
- IP if available.

Support current filters and export.

Audit entries must look immutable/read-only.

---

# PHASE 28 — DATA MANAGEMENT

Improve:

- import
- export
- retention
- archive
- backup information
- destructive actions

Use a visually separated Danger Zone.

All destructive actions must use clear confirmation.

Do not change retention/deletion logic.

---

# PHASE 29 — SUBSCRIPTION

Keep current billing/business behavior.

Improve visual presentation of:

- current plan
- usage
- users
- sites
- storage
- renewal
- billing
- plan comparison

If On-Premise customers should not see SaaS subscription information, preserve whatever current role/deployment logic already controls that.

---

# PHASE 30 — NOTIFICATIONS

Create a clean notification center around existing notification types.

Potential categories if existing:

- quality alerts
- approvals
- tasks
- SPC alerts
- system notifications

Support:
- read/unread
- click to related record
- filters if already available.

---

# PHASE 31 — LANGUAGE SYSTEM

The application must support:

- Turkish
- English
- French

Requirements:

- no random mixed-language interface,
- shared translation keys,
- persistent user language,
- layout must tolerate longer French labels,
- technical industry terminology may remain in English where appropriate.

Do not hardcode translated strings directly into random components.

Use the project's existing i18n architecture if available.

If none exists:
- create a minimal maintainable i18n structure,
- do not over-engineer.

---

# PHASE 32 — ACCESSIBILITY / KEYBOARD

Apply globally.

Requirements:

- visible keyboard focus
- logical tab order
- Escape closes drawer/modal
- Enter activates appropriate forms/actions
- semantic labels
- status must not rely only on color
- accessible dialogs
- accessible tables
- reduced motion support.

Measurement terminal should be especially keyboard-friendly.

---

# PHASE 33 — MICROINTERACTION

Keep motion subtle.

Use for:

- hover
- selection
- tab change
- save
- publish
- NOK detection
- chart point appearance
- drawer
- sample progress
- measurement confirmation

Typical duration:
150–300ms.

Do not bring long marketing-site cinematic transitions into normal application workflows.

---

# PHASE 34 — RITIM PULSE LANGUAGE

Use the Ritim signal/pulse motif only where it has meaning.

Good use cases:

- logo / brand shell
- Quality Pulse dashboard chart
- SPC / trend
- NOK detection
- loading indicator
- traceability relation
- selected/highlight state

Bad use case:
- decorative pulse lines on every card.

---

# PHASE 35 — DESKTOP VALIDATION

Before starting mobile, verify all desktop pages.

Check:

- 1920px
- 1440px
- 1366px
- 1280px

Check:

- sidebar
- all major routes
- tables
- forms
- Plan Editor
- Measurement Terminal
- SPC
- drawers
- dialogs
- empty states
- loading
- errors
- permissions
- translation.

Do not start mobile before desktop reaches a stable state.

---

# PHASE 36 — MOBILE STRATEGY

Only after desktop is stable.

Do NOT simply shrink the desktop UI.

Prioritize real mobile/shop-floor workflows.

Mobile priority order:

1. QR Scan
2. Measurement Terminal
3. My Tasks
4. Approvals
5. Nonconformity Quick Entry
6. Measurement History
7. Notifications
8. Product / plan view-only screens where useful

Do not attempt to make the full Control Plan Editor equally editable on a small phone unless explicitly requested.

---

# PHASE 37 — MOBILE NAVIGATION

Consider a bottom navigation.

Recommended information architecture where current routes allow:

- Home
- Tasks
- Scan
- Records
- More

The Scan action may be emphasized.

Administration belongs under More.

Do not duplicate every desktop navigation item in the bottom bar.

---

# PHASE 38 — MOBILE MEASUREMENT TERMINAL

Optimize for one-hand use.

Show:

- Product
- Work Order
- Sample number
- Characteristic
- drawing/image if available
- Target
- Tolerance
- Measurement
- Unit
- OK / NOK
- Save
- Next
- Camera
- Comment

Requirements:

- large touch targets
- large measurement value
- sticky primary action
- minimal typing
- numeric keyboard where applicable
- clear NOK state
- keep current business rules.

---

# PHASE 39 — MOBILE QR

Full-screen scan experience.

Support current behavior:

- camera
- scan frame
- manual code entry
- scan success
- error
- product/WO confirmation.

Where technically possible:
- torch control.

Handle iOS/PWA camera permission errors gracefully.

---

# PHASE 40 — MOBILE TASKS

Create a compact task-oriented view.

Prioritize:

- today's tasks
- priority
- due
- product/context
- one-tap open
- complete if current workflow supports it.

Use bottom sheets instead of large desktop drawers.

---

# PHASE 41 — MOBILE APPROVALS

Show:

- approval summary
- requested by
- revision / entity
- important changed values
- comment
- approve
- reject

Use large touch-friendly actions.

---

# PHASE 42 — MOBILE NONCONFORMITY ENTRY

If existing functionality supports creating NC:

Optimize quick entry for:

- source inspection
- product
- lot
- severity
- reason
- photo
- comment
- submit.

Do not add fields that do not exist in the data model.

---

# PHASE 43 — MOBILE VISUAL LANGUAGE

Keep the desktop brand identity.

Mobile differences:

- bigger touch typography
- fewer simultaneous columns
- stacked content
- bottom sheets
- sticky primary actions
- horizontal swipe where natural
- minimal typing
- camera-friendly
- approximately 44px minimum touch targets.

---

# PHASE 44 — PERFORMANCE

Do not sacrifice application speed for visual polish.

Requirements:

- avoid unnecessary re-renders,
- lazy load heavy charts where useful,
- avoid large animation libraries unless already present,
- avoid excessive shadows/blurs,
- virtualize very large tables only if needed,
- avoid layout shift,
- use skeletons for async data.

---

# PHASE 45 — FINAL QUALITY CHECK

Before declaring the redesign complete:

## Visual consistency
- same buttons everywhere
- same status colors
- same form sizing
- same tables
- same headers
- same spacing
- same chart language
- same typography

## Functional regression
Verify:
- create
- edit
- save
- publish
- approve
- reject
- measurements
- QR
- records
- filters
- exports
- printing
- SPC
- settings
- permissions
- language.

## Signature screens
Give extra QA attention to:

1. Control Plan Editor
2. Measurement Terminal
3. SPC

These are the visual/product signature screens of Ritim Quality.

---

# IMPLEMENTATION PRIORITY SUMMARY

If the full scope cannot be completed in one iteration, use this exact priority:

## Priority A — Foundation
1. Design System
2. App Shell
3. Page Header
4. Shared table / form / drawer / modal

## Priority B — Core showcase screens
5. Overview
6. Products
7. Product Detail
8. Control Plans
9. Control Plan Editor
10. Measurement Preparation
11. Measurement Terminal
12. Measurement Records
13. SPC

## Priority C — Quality workflow
14. Tasks
15. Nonconformities
16. Approvals
17. Traceability
18. Reports

## Priority D — Administration
19. Users
20. Settings
21. Business Rules
22. Audit
23. Data Management
24. Subscription
25. Notifications

## Priority E — Mobile
26. Mobile navigation
27. QR
28. Measurement Terminal
29. Tasks
30. Approvals
31. Nonconformity quick entry
32. Records

---

# FINAL INSTRUCTION TO CODEX

Proceed through this revision **sequentially**.

Do not jump to later screens before the shared design primitives are stable.

At every step:

1. inspect the current implementation,
2. reuse the current business logic,
3. identify reusable components,
4. implement the visual/UX revision,
5. test the affected flows,
6. remove obsolete duplicated styles only when safe,
7. keep the code maintainable,
8. continue to the next phase.

When there is a conflict between visual redesign and existing functionality:

**preserve functionality first.**

When uncertain whether a new feature should be added:

**do not invent it.**

When a page contains additional existing behavior not covered in this prompt:

**keep the behavior and adapt it to the new design system.**

The finished application should feel like:

**Ritim Quality — a serious industrial quality management product, not a generic admin dashboard and not a marketing website.**
